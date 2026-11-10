/**
 * One live call per role through the gateway (S01 spike): what Otari served, the receipt, and the
 * refusal shape. Run: OTARI_API_KEY=… pnpm --filter @teire/engine exec tsx scripts/otari-spike.ts
 */
import { generateText, Output } from "ai";
import { z } from "zod";
import { createGateway, type Role, receiptOf } from "../src/gateway";

const ai = await createGateway().as(null);
const roles = (process.argv[2]?.split(",") ?? ["reader"]) as Role[];
for (const role of roles) {
  const started = Date.now();
  try {
    const result = await generateText({
      ...ai.call(role, { purpose: "spike" }),
      prompt: "Name one breaking change between zod 3 and zod 4, in one short sentence.",
      output: Output.object({ schema: z.object({ change: z.string() }) }),
      maxOutputTokens: Number(process.env.SPIKE_MAX_OUT ?? 400),
    });
    const r = receiptOf(result);
    console.log(
      JSON.stringify({
        role,
        asked: ai.modelId(role),
        served: r.servedModel,
        provider: r.provider,
        fallback: r.fallback,
        attempts: r.attempts,
        tokens: [r.tokensIn, r.tokensOut],
        costUsd: r.costUsd,
        pricing: r.pricingSource,
        requestId: r.requestId,
        ms: Date.now() - started,
        answer: result.output.change.slice(0, 120),
      }),
    );
  } catch (error) {
    console.log(
      JSON.stringify({
        role,
        error: (error as Error).name,
        message: String((error as Error).message).slice(0, 300),
      }),
    );
  }
}
