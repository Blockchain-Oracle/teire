import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, type LanguageModel } from "ai";
import { GATEWAY, ROLE_DEFAULTS, ROLE_ENV } from "../constants";
import { GatewayNotConfiguredError, gatewayFetch } from "./errors";
import type { EndUser } from "./identity";
import { otariMetadata, receiptOf } from "./receipt";
import { createOtariRest, type OtariRest } from "./rest";

/** Which job a model does; each maps to a model, a selector or (S02) a routing policy. */
export type Role = keyof typeof ROLE_ENV;

export interface GatewayConfig {
  apiKey: string;
  baseURL: string;
  models: Record<Role, string>;
}

/**
 * The server holds a service key (`OTARI_SERVICE_KEY`), whose end users carry the per-person and
 * per-installation budgets; the CLI runs on an ordinary key (`OTARI_API_KEY`) and names no end user.
 */
export function gatewayConfigFromEnv(env: NodeJS.ProcessEnv = process.env): GatewayConfig {
  const apiKey = env.OTARI_SERVICE_KEY || env.OTARI_API_KEY;
  if (!apiKey)
    throw new GatewayNotConfiguredError("OTARI_SERVICE_KEY is not set (Otari key, docs/otari-setup.md)");
  const models = Object.fromEntries(
    (Object.keys(ROLE_ENV) as Role[]).map((role) => [role, env[ROLE_ENV[role]] || ROLE_DEFAULTS[role]]),
  ) as Record<Role, string>;
  return { apiKey, baseURL: (env.OTARI_BASE_URL || GATEWAY.baseUrl).replace(/\/+$/, ""), models };
}

/** A guardrail Otari runs on the latest user message (`mode: block` refuses the whole request). */
export interface GuardrailConfig {
  profile: string;
  mode?: "block" | "monitor";
  on_unavailable?: "block" | "monitor";
}

/** A remote MCP server Otari connects to for this request (Streamable HTTP). */
export interface McpServer {
  name: string;
  url: string;
  authorization_token?: string;
  purpose_hint?: string;
  allowed_tools?: string[] | null;
}

/** A tool Otari runs itself inside its loop; the model sees it as `web_search`, `web_fetch`, `code_execution`. */
export type OtariTool =
  | {
      type: "otari_web_search";
      max_uses?: number;
      max_results?: number;
      allowed_domains?: string[];
      blocked_domains?: string[];
      purpose_hint?: string;
    }
  | { type: "otari_web_fetch" }
  | { type: "otari_code_execution"; container?: string };

export interface CallOptions {
  guardrails?: GuardrailConfig[];
  mcpServers?: McpServer[];
  otariTools?: OtariTool[];
  maxToolIterations?: number;
  /** A tag on Otari's usage rows (`metadata.purpose`), e.g. `fix`, `notes`, `triage`. */
  purpose?: string;
}

/** What a call spreads into `generateText` / `streamText`: the model and Otari's request fields. */
export interface CallSettings {
  model: LanguageModel;
  providerOptions: { otari: Record<string, never> };
  headers?: Record<string, string>;
}

/** One gateway, bound to whoever pays for the calls made through it. */
export interface Ai {
  readonly endUser: EndUser | null;
  readonly rest: OtariRest;
  /** The model id (or selector, or policy) a role asks for; `Otari-Model` says what answered. */
  modelId(role: Role): string;
  call(role: Role, options?: CallOptions): CallSettings;
}

/**
 * Otari's own tools ride in the body as `otariTools`: the AI SDK writes its own `tools` after the
 * provider options, so they are moved into `tools` here, beside any function tools of the caller.
 */
function withOtariTools(args: Record<string, unknown>) {
  const { otariTools, ...rest } = args as { otariTools?: unknown[] } & Record<string, unknown>;
  if (!otariTools?.length) return rest;
  return { ...rest, tools: [...((rest.tools as unknown[] | undefined) ?? []), ...otariTools] };
}

export function createGateway(config: GatewayConfig = gatewayConfigFromEnv(), fetchImpl?: typeof fetch) {
  const provider = createOpenAICompatible({
    name: GATEWAY.providerName,
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    includeUsage: true,
    supportsStructuredOutputs: true,
    metadataExtractor: otariMetadata,
    transformRequestBody: withOtariTools,
    fetch: gatewayFetch(fetchImpl),
  });
  const rest = createOtariRest(config, fetchImpl);

  /**
   * The service key's end-user budgets, or null for an ordinary key. Only a service key may name end
   * users: an ordinary key that sends `user` is refused (403), so its calls are billed to the key and
   * name nobody. The answer is kept once known; a failed read is asked again next time.
   */
  let budgets: Promise<Map<string, string> | null> | null = null;
  const serviceBudgets = () => {
    budgets ??= rest.budgetsByName().then(
      (map) => new Map([...map].map(([name, b]) => [name, b.budget_id])),
      (error: unknown) => {
        if (/requires a service key/i.test(String(error))) return null;
        budgets = null;
        return null;
      },
    );
    return budgets;
  };

  /** A client billed to `endUser` (a service key's end user), or to the key itself when null. */
  async function as(requested: EndUser | null): Promise<Ai> {
    const service = requested ? await serviceBudgets() : null;
    const endUser = service ? requested : null;
    // Only a new end user reads this header: it is the budget Otari starts it on.
    const budget = endUser ? (service?.get(endUser.budget) ?? null) : null;
    return {
      endUser,
      rest,
      modelId: (role) => config.models[role],
      call: (role, options = {}) => {
        const otari: Record<string, unknown> = {
          ...(endUser ? { user: endUser.id } : {}),
          metadata: { app: "teire", role, ...(options.purpose ? { purpose: options.purpose } : {}) },
          ...(options.guardrails?.length ? { guardrails: options.guardrails } : {}),
          ...(options.mcpServers?.length ? { mcp_servers: options.mcpServers } : {}),
          ...(options.otariTools?.length ? { otariTools: options.otariTools } : {}),
          ...(options.maxToolIterations ? { max_tool_iterations: options.maxToolIterations } : {}),
        };
        return {
          model: provider(config.models[role]),
          providerOptions: { otari: otari as Record<string, never> },
          ...(budget ? { headers: { "Otari-End-User-Budget": budget } } : {}),
        };
      },
    };
  }

  return { config, rest, as };
}

export type Gateway = ReturnType<typeof createGateway>;

/** One short reachability check that costs nothing: the key's own budget report. */
export async function ping(gateway: Gateway) {
  const started = Date.now();
  const budget = await gateway.rest.keyBudget();
  return { ok: true as const, latencyMs: Date.now() - started, remainingUsd: budget.remaining_usd ?? null };
}

/** One tiny real model call (a few tokens on the reader): what a balance or model check needs. */
export async function pingModel(ai: Ai) {
  const started = Date.now();
  const result = await generateText({
    ...ai.call("reader", { purpose: "ping" }),
    prompt: "Reply with the single word: ready",
    maxOutputTokens: 16,
  });
  return { text: result.text.trim(), latencyMs: Date.now() - started, ...receiptOf(result) };
}
