import type { MetadataExtractor } from "@ai-sdk/openai-compatible";
import type { LanguageModelUsage } from "ai";
import { GATEWAY } from "../constants";

/**
 * What one Otari call did, for the run page, the PR's receipt and `llm_calls`: tokens and Otari's own
 * cost, which model and provider actually answered (after any fallback), the guardrail verdicts and
 * the tools Otari ran itself. Cost comes from the body (`usage.cost_usd`), never from a price list.
 */
export interface GatewayReceipt {
  tokensIn: number;
  tokensCached: number;
  tokensOut: number;
  costUsd: number;
  /** `organization` | `deployment` | `defaults`; null when Otari could not price the call. */
  pricingSource: string | null;
  requestId: string | null;
  /** The model the provider ran, without its instance prefix (`Otari-Model`). */
  servedModel: string | null;
  provider: string | null;
  fallback: boolean;
  attempts: number | null;
  guardrails: GuardrailVerdict[];
  toolCalls: OtariToolCall[];
  /** The budget the end user was on when this call was billed (`Otari-End-User-Budget`). */
  endUserBudget: string | null;
}

/** A receipt as Teire keeps it: the step, the model id it asked for, its wall time, and Otari's receipt. */
export type StepReceipt<S extends string = string> = GatewayReceipt & { step: S; model: string; ms: number };

export interface GuardrailVerdict {
  profile: string;
  mode: string;
  valid: boolean | null;
  score: number | null;
  status: string;
  reason?: string;
}

/** A tool Otari ran inside its own loop (`otari_tool_calls`), as reported. */
export interface OtariToolCall {
  id: string;
  type: "web_search" | "web_fetch" | "code_execution" | "mcp" | string;
  status: "in_progress" | "completed" | "failed" | string;
  query?: string;
  url?: string;
  sources?: { url: string; title?: string; published_date?: string }[];
  code?: string;
  stdout?: string;
  stderr?: string;
  exit_code?: number;
  server?: string;
  name?: string;
  output?: string;
  truncated?: boolean;
  error?: { provider?: string; status?: number; tag?: string; retryable?: boolean };
}

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

interface OtariBody {
  usage?: { cost_usd?: string | number | null; pricing_source?: string | null } | null;
  otari_tool_calls?: OtariToolCall[] | null;
}

const costOf = (v: unknown) => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : Number.NaN;
  return Number.isFinite(n) ? n : null;
};

/** Body-only facts under `providerMetadata.otari`, for whole responses and streams alike. */
export const otariMetadata: MetadataExtractor = {
  extractMetadata: async ({ parsedBody }) => {
    const b = (parsedBody ?? {}) as OtariBody;
    return {
      [GATEWAY.providerName]: {
        costUsd: costOf(b.usage?.cost_usd),
        pricingSource: b.usage?.pricing_source ?? null,
        toolCalls: (b.otari_tool_calls ?? []) as unknown as Json[],
      },
    };
  },
  createStreamExtractor: () => {
    let cost: number | null = null;
    let pricing: string | null = null;
    // A stream reports each tool call when it starts and again when it ends: the ended entry replaces it.
    const calls = new Map<string, OtariToolCall>();
    return {
      processChunk(chunk) {
        const b = (chunk ?? {}) as OtariBody;
        const c = costOf(b.usage?.cost_usd);
        if (c != null) cost = c;
        if (b.usage?.pricing_source) pricing = b.usage.pricing_source;
        for (const t of b.otari_tool_calls ?? []) if (t?.id) calls.set(t.id, { ...calls.get(t.id), ...t });
      },
      buildMetadata: () => ({
        [GATEWAY.providerName]: {
          costUsd: cost,
          pricingSource: pricing,
          toolCalls: [...calls.values()] as unknown as Json[],
        },
      }),
    };
  },
};

/** One step or one whole call of the AI SDK: its usage, its metadata and its response headers. */
export interface CallLike {
  usage?: LanguageModelUsage | undefined;
  providerMetadata?: Record<string, Record<string, unknown>> | undefined;
  response?: { headers?: Record<string, string> | undefined } | undefined;
}

const header = (h: Record<string, string> | undefined, name: string) => {
  if (!h) return null;
  const key = Object.keys(h).find((k) => k.toLowerCase() === name);
  return key ? (h[key] ?? null) : null;
};

const parseJson = <T>(s: string | null): T | null => {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
};

export function receiptOf(call: CallLike): GatewayReceipt {
  const meta = (call.providerMetadata?.[GATEWAY.providerName] ?? {}) as {
    costUsd?: number | null;
    pricingSource?: string | null;
    toolCalls?: OtariToolCall[];
  };
  const h = call.response?.headers;
  const attempts = Number(header(h, "otari-attempt-count"));
  return {
    tokensIn: call.usage?.inputTokens ?? 0,
    tokensCached: call.usage?.inputTokenDetails?.cacheReadTokens ?? 0,
    tokensOut: call.usage?.outputTokens ?? 0,
    costUsd: meta.costUsd ?? 0,
    pricingSource: meta.pricingSource ?? null,
    requestId: header(h, "otari-request-id"),
    servedModel: header(h, "otari-model"),
    provider: header(h, "otari-provider"),
    fallback: header(h, "otari-fallback") === "true",
    attempts: Number.isFinite(attempts) && attempts > 0 ? attempts : null,
    guardrails: parseJson<GuardrailVerdict[]>(header(h, "otari-guardrails")) ?? [],
    toolCalls: meta.toolCalls ?? [],
    endUserBudget: header(h, "otari-end-user-budget"),
  };
}

/** Several calls as one receipt (an agent's steps, a reply's tool rounds): summed, the last one's facts kept. */
export function sumReceipts(receipts: GatewayReceipt[]): GatewayReceipt | null {
  const last = receipts.at(-1);
  if (!last) return null;
  return {
    ...last,
    tokensIn: receipts.reduce((n, r) => n + r.tokensIn, 0),
    tokensCached: receipts.reduce((n, r) => n + r.tokensCached, 0),
    tokensOut: receipts.reduce((n, r) => n + r.tokensOut, 0),
    costUsd: receipts.reduce((n, r) => n + r.costUsd, 0),
    fallback: receipts.some((r) => r.fallback),
    attempts: receipts.reduce((n, r) => n + (r.attempts ?? 1), 0),
    guardrails: receipts.flatMap((r) => r.guardrails),
    toolCalls: receipts.flatMap((r) => r.toolCalls),
  };
}

/** The empty receipt of a call that failed before Otari answered. */
export const noReceipt = (): GatewayReceipt => ({
  tokensIn: 0,
  tokensCached: 0,
  tokensOut: 0,
  costUsd: 0,
  pricingSource: null,
  requestId: null,
  servedModel: null,
  provider: null,
  fallback: false,
  attempts: null,
  guardrails: [],
  toolCalls: [],
  endUserBudget: null,
});
