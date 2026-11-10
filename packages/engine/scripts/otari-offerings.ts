/**
 * Which concrete provider offerings of each role's model answer on Otari, with structured output, so
 * the routing policies (docs/otari-setup.md step 6) list only offerings that work (plan S02).
 * Reads every offering from Otari's catalog (`GET /api/v1/catalog/models/{id}`), sends each one small
 * JSON-schema request billed to the key, and prints one line per offering: status, latency, cost,
 * the provider that answered and whether Otari fell back.
 * `--policies` calls each role's routing policy (`teire-<role>`) once instead: every one must answer
 * before `TEIRE_MODEL_<ROLE>` points the role at it.
 * Run: pnpm --filter @teire/engine exec tsx scripts/otari-offerings.ts [--policies] (Otari key in the env).
 */
import { generateText, Output } from "ai";
import { z } from "zod";
import { ROLE_DEFAULTS } from "../src/constants";
import { createGateway, gatewayConfigFromEnv, receiptOf } from "../src/gateway";

const config = gatewayConfigFromEnv();
const MODELS = [...new Set([...Object.values(ROLE_DEFAULTS), "moonshotai/kimi-k2.6"])];

interface Offering {
  selector: string;
  provider: string;
  endpoints: string[];
  pricing?: { input_price_per_million?: number; output_price_per_million?: number };
}

async function offeringsOf(model: string): Promise<Offering[]> {
  const res = await fetch(`${config.baseURL}/catalog/models/${model}`, {
    headers: { authorization: `Bearer ${config.apiKey}` },
  });
  if (!res.ok) throw new Error(`catalog ${model}: ${res.status}`);
  return ((await res.json()) as { offerings: Offering[] }).offerings;
}

const Answer = z.object({ verdict: z.enum(["safe", "breaking"]), reason: z.string() });

async function probe(selector: string) {
  const ai = await createGateway({ ...config, models: { ...config.models, reader: selector } }).as(null);
  const started = Date.now();
  const result = await generateText({
    ...ai.call("reader", { purpose: "offering-probe" }),
    output: Output.object({ schema: Answer }),
    maxOutputTokens: 2000,
    maxRetries: 0,
    prompt:
      "A library's release notes say: 'v3 removes the callback form of get(); use the promise form.' " +
      "A repository calls get(url, cb) twice. Is upgrading safe or breaking? One short reason.",
  });
  return { ms: Date.now() - started, verdict: result.output.verdict, ...receiptOf(result) };
}

if (process.argv.includes("--policies")) {
  for (const role of Object.keys(ROLE_DEFAULTS)) {
    const policy = `teire-${role}`;
    const r = await probe(policy).then(
      (x) => ({
        ok: true,
        ms: x.ms,
        servedModel: x.servedModel,
        provider: x.provider,
        attempts: x.attempts,
        fallback: x.fallback,
      }),
      (e: Error) => ({ ok: false, error: e.message.slice(0, 220) }),
    );
    console.log(JSON.stringify({ role, policy, ...r }));
  }
  process.exit(0);
}

for (const model of MODELS) {
  for (const o of await offeringsOf(model)) {
    const line = { model, selector: o.selector, endpoints: o.endpoints, price: o.pricing };
    if (!o.endpoints.includes("/chat/completions")) {
      console.log(JSON.stringify({ ...line, skipped: "no /chat/completions" }));
      continue;
    }
    const r = await probe(o.selector).then(
      (x) => ({
        ok: true,
        ms: x.ms,
        verdict: x.verdict,
        costUsd: x.costUsd,
        servedModel: x.servedModel,
        provider: x.provider,
        fallback: x.fallback,
        tokensOut: x.tokensOut,
      }),
      (e: Error) => ({ ok: false, error: e.message.slice(0, 220) }),
    );
    console.log(JSON.stringify({ ...line, ...r }));
  }
}
