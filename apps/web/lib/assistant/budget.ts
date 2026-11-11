import { assistantCalls, eq, sql, systemState } from "@teire/db";
import { ALLOWANCE } from "@teire/engine/constants";
import { type Ai, type GatewayReceipt, refusalSaid, startRefusal } from "@teire/engine/gateway";
import { database } from "../db";

/**
 * Ask Teire's allowance is the person's own on Otari (D127, now Otari's): every reply is billed to them
 * as an end user of the service key, on the dashboard budget their account is on, and Otari refuses a
 * call whose hold doesn't fit. Before the model runs, the reply checks that what is left covers one
 * reply (ALLOWANCE.replyUsd), so a person whose allowance is spent reads when it comes back instead of
 * a reply cut off halfway. Fix runs bill their installation, so chatting never stops a fix. Each
 * reply's row is reserved first and then carries Otari's receipt: its cost, model and provider.
 */
const DAY = sql`now() - interval '24 hours'`;

export type Reservation = { id: number } | { blocked: string };

export async function reserve(input: {
  ai: Ai;
  userId: string | null;
  threadId: string;
  model: string;
}): Promise<Reservation> {
  const db = database();
  const [credits] = await db.select().from(systemState).where(eq(systemState.key, "credits")).limit(1);
  if ((credits?.value as { exhausted?: boolean } | undefined)?.exhausted)
    return { blocked: "Teire's Otari balance is used up for now, so Ask Teire can't answer." };
  const refusal = await startRefusal(input.ai, ALLOWANCE.replyUsd);
  if (refusal) return { blocked: refusalSaid(refusal, input.ai.endUser?.id ?? null) };
  const [row] = await db
    .insert(assistantCalls)
    .values({
      userId: input.userId ?? "operator",
      threadId: input.threadId,
      model: input.model,
      costUsd: "0",
      status: "reserved",
    })
    .returning({ id: assistantCalls.id });
  return { id: row?.id ?? 0 };
}

/** The reply's receipt: its real tokens and cost, replacing the reservation. */
export async function settle(
  id: number,
  receipt: {
    messageId: string | null;
    model: string;
    tokensIn: number;
    tokensOut: number;
    costUsd: number;
    latencyMs: number;
    failed?: boolean;
    endUser?: string | null;
  } & Partial<GatewayReceipt>,
) {
  await database()
    .update(assistantCalls)
    .set({
      messageId: receipt.messageId,
      model: receipt.model,
      tokensIn: receipt.tokensIn,
      tokensOut: receipt.tokensOut,
      costUsd: receipt.costUsd.toFixed(6),
      latencyMs: receipt.latencyMs,
      status: receipt.failed ? "failed" : "done",
      endUser: receipt.endUser ?? null,
      requestId: receipt.requestId ?? null,
      servedModel: receipt.servedModel ?? null,
      provider: receipt.provider ?? null,
      fallback: receipt.fallback ?? false,
      toolCalls: receipt.toolCalls ?? [],
      guardrails: receipt.guardrails ?? [],
    })
    .where(eq(assistantCalls.id, id));
}

/** This person's Ask Teire spend from the receipts: today's and the last 30 days' (Settings › Usage, the usage tool). */
export async function assistantSpend(userId: string | null) {
  const who = userId ?? "operator";
  const [row] = (
    await database().execute<{ today: string; month: string; replies: number; tokens: string }>(sql`
      select coalesce(sum(cost_usd) filter (where created_at > ${DAY}), 0) as today,
        coalesce(sum(cost_usd), 0) as month, count(*)::int as replies,
        coalesce(sum(tokens_in + tokens_out), 0)::bigint as tokens
      from assistant_calls where user_id = ${who} and created_at > now() - interval '30 days' and status <> 'failed'`)
  ).rows;
  return {
    todayUsd: Number(row?.today ?? 0),
    monthUsd: Number(row?.month ?? 0),
    replies: row?.replies ?? 0,
    tokens: Number(row?.tokens ?? 0),
  };
}
