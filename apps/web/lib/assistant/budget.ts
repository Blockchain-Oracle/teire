import { assistantCalls, eq, sql, systemState } from "@teire/db";
import { ASSISTANT, DAILY_COST_CAP_DEFAULT_USD } from "@teire/engine/constants";
import type { GatewayReceipt } from "@teire/engine/gateway";
import { database } from "../db";

/**
 * Ask Teire's budget (D127): its own daily caps, per person and across everyone, apart from fix
 * runs, so chatting never stops a fix (`modelWorkBlocked` reads only `llm_calls`). A reply is
 * reserved at an estimate before the model runs, under one lock, so concurrent questions can't all
 * pass a cap that only one of them fits under; the receipt then replaces the estimate with the cost.
 * An empty Otari balance and the overall daily cap (fixes and chat together) also stop it. Each
 * reply's cost is Otari's own (`usage.cost_usd`), with the model and provider that answered.
 */
const DAY = sql`now() - interval '24 hours'`;

/** The overall model budget per day, as the worker reads it (its default when unset). */
const OVERALL_CAP_USD = Number(process.env.TEIRE_DAILY_COST_CAP_USD ?? DAILY_COST_CAP_DEFAULT_USD);

export type Reservation = { id: number } | { blocked: string };

/** What a person reads when their own daily allowance is spent (also the kit's notice card). */
export const personBudgetSaid = (allowance: number) =>
  `You've used today's Ask Teire budget ($${allowance.toFixed(2)} a day); it frees up over the next 24 hours.`;

export async function reserve(input: {
  userId: string | null;
  threadId: string;
  model: string;
}): Promise<Reservation> {
  const db = database();
  const who = input.userId ?? "operator";
  const [credits] = await db.select().from(systemState).where(eq(systemState.key, "credits")).limit(1);
  if ((credits?.value as { exhausted?: boolean } | undefined)?.exhausted)
    return { blocked: "Teire's Otari balance is used up for now, so Ask Teire can't answer." };
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('teire:assistant-budget'))`);
    const [spent] = (
      await tx.execute<{ mine: string; everyone: string; fixes: string }>(sql`
        select
          coalesce(sum(cost_usd) filter (where user_id = ${who}), 0) as mine,
          coalesce(sum(cost_usd), 0) as everyone,
          (select coalesce(sum(cost_usd), 0) from llm_calls where created_at > ${DAY}) as fixes
        from assistant_calls where created_at > ${DAY} and status <> 'failed'`)
    ).rows;
    const mine = Number(spent?.mine ?? 0);
    const everyone = Number(spent?.everyone ?? 0);
    const fixes = Number(spent?.fixes ?? 0);
    const next = ASSISTANT.estimateUsd;
    const allowance = input.userId === null ? ASSISTANT.operatorDailyUsd : ASSISTANT.perUserDailyUsd;
    if (mine + next > allowance)
      return {
        blocked: personBudgetSaid(allowance),
      };
    if (everyone + next > ASSISTANT.totalDailyUsd)
      return {
        blocked:
          "Ask Teire's budget for today is used up across everyone; it frees up over the next 24 hours.",
      };
    if (OVERALL_CAP_USD > 0 && fixes + everyone + next > OVERALL_CAP_USD)
      return { blocked: "Today's model budget is used up; Teire keeps it for fixes until it frees up." };
    const [row] = await tx
      .insert(assistantCalls)
      .values({
        userId: who,
        threadId: input.threadId,
        model: input.model,
        costUsd: next.toFixed(6),
        status: "reserved",
      })
      .returning({ id: assistantCalls.id });
    return { id: row?.id ?? 0 };
  });
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

/** This person's assistant spend: today's and the last 30 days' (Settings › Usage, the usage tool). */
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
    dailyCapUsd: ASSISTANT.perUserDailyUsd,
  };
}
