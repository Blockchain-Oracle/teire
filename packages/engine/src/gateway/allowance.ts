import { END_USERS } from "../constants";
import type { Ai } from "./client";
import type { EndUser } from "./identity";
import type { EndUserBudget, OtariRest } from "./rest";

/**
 * Allowances as Otari keeps them: Teire never counts money itself. An end user's allowance is the
 * budget the service key put it on (by name in the dashboard), what it has spent this period, and
 * what calls still running hold: Otari holds each call's prompt and full output limit until it
 * settles, and refuses a call whose hold doesn't fit (403 `budget_exceeded`). Reading it first lets
 * a run or a reply say so before starting, with the time it comes back.
 */
export interface Allowance {
  endUser: string;
  /** The dashboard budget it is on (`teire-person-daily`, `teire-walk-tiny`, …), null when unknown. */
  budget: string | null;
  budgetId: string | null;
  /** Null when the budget caps no money (tokens or requests only). */
  limitUsd: number | null;
  spentUsd: number;
  /** Held by calls still running. */
  heldUsd: number;
  /** What is left to start new calls with; null with no money limit. */
  leftUsd: number | null;
  /** Blocked by the operator: refused whatever is left. */
  blocked: boolean;
  /** When the period starts again (the budget's calendar reset), null before its first call. */
  resetsAt: string | null;
  /** False before its first call: Otari creates the end user then, on `budget`. */
  exists: boolean;
}

/** The service key's own ceiling: every end user together. */
export interface KeyAllowance {
  enforced: boolean;
  /** Null when the key has no money ceiling. */
  leftUsd: number | null;
  limitUsd: number | null;
  usedUsd: number | null;
  resetsAt: string | null;
  /** Which ceiling is tightest: `api_key`, `organization`, `workspace`, … */
  scope: string | null;
}

/** Why work can't start now: whose allowance and when it comes back. */
export interface StartRefusal {
  scope: "user" | "key";
  blocked: boolean;
  leftUsd: number | null;
  /** What the work needed left to start (what one attempt or reply may hold at once). */
  needUsd: number;
  resetsAt: Date | null;
  allowance: Allowance | null;
}

const money = (n: number) => Math.round(n * 1e6) / 1e6;

/** The next UTC calendar boundary of a budget's period (Otari's `reset_alignment`); weeks start Monday. */
function nextBoundary(alignment: string | null | undefined, now = new Date()): string | null {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (alignment === "calendar_day") d.setUTCDate(d.getUTCDate() + 1);
  else if (alignment === "calendar_week") d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7));
  else if (alignment === "calendar_month") d.setUTCMonth(d.getUTCMonth() + 1, 1);
  else return null;
  return d.toISOString();
}

function budgetById(budgets: Map<string, EndUserBudget>, id: string | null | undefined) {
  if (!id) return undefined;
  for (const b of budgets.values()) if (b.budget_id === id) return b;
  return undefined;
}

/** One end user's allowance now. Its spend counts as zero once its period has passed. */
export async function allowanceOf(rest: OtariRest, endUser: EndUser): Promise<Allowance> {
  const [record, budgets] = await Promise.all([rest.endUser(endUser.id), rest.budgetsByName()]);
  const budget = record ? budgetById(budgets, record.budget_id) : budgets.get(endUser.budget);
  // Otari starts a new period at the end user's next call; until then its record shows the last one.
  const lapsed = Boolean(
    record?.next_budget_reset_at && Date.parse(record.next_budget_reset_at) <= Date.now(),
  );
  const spent = lapsed ? 0 : (record?.spend ?? 0);
  const held = lapsed ? 0 : (record?.reserved ?? 0);
  const limit = budget?.max_budget ?? null;
  return {
    endUser: endUser.id,
    budget: budget?.name ?? null,
    budgetId: budget?.budget_id ?? null,
    limitUsd: limit,
    spentUsd: money(spent),
    heldUsd: money(held),
    leftUsd: limit === null ? null : money(Math.max(0, limit - spent - held)),
    blocked: record?.blocked ?? false,
    resetsAt: (!lapsed && record?.next_budget_reset_at) || nextBoundary(budget?.reset_alignment),
    exists: Boolean(record),
  };
}

/** The key's tightest money ceiling now (`GET /key/budget`). */
export async function keyAllowance(rest: OtariRest): Promise<KeyAllowance> {
  const report = await rest.keyBudget();
  const tight = report.limits
    .filter((l) => l.remaining_usd !== null && l.remaining_usd !== undefined)
    .sort((a, b) => (a.remaining_usd ?? 0) - (b.remaining_usd ?? 0))[0];
  return {
    enforced: report.budgets_enforced,
    leftUsd: report.remaining_usd ?? null,
    limitUsd: tight?.limit_usd ?? null,
    usedUsd: tight?.used_usd ?? null,
    resetsAt: tight?.resets_at ?? null,
    scope: tight?.scope ?? null,
  };
}

/**
 * Whether work that may hold up to `needUsd` at once can start for this caller: its own allowance
 * first, then the key's ceiling. Null when it can, or when Otari didn't answer (the call itself is
 * still refused by Otari if the money isn't there, so a failed read never blocks work).
 */
export async function startRefusal(ai: Ai, needUsd: number): Promise<StartRefusal | null> {
  try {
    const [mine, key] = await Promise.all([
      ai.endUser ? allowanceOf(ai.rest, ai.endUser) : Promise.resolve(null),
      keyAllowance(ai.rest),
    ]);
    if (mine && (mine.blocked || (mine.leftUsd !== null && mine.leftUsd < needUsd)))
      return {
        scope: "user",
        blocked: mine.blocked,
        leftUsd: mine.leftUsd,
        needUsd,
        resetsAt: mine.resetsAt ? new Date(mine.resetsAt) : null,
        allowance: mine,
      };
    if (key.enforced && key.leftUsd !== null && key.leftUsd < needUsd)
      return {
        scope: "key",
        blocked: false,
        leftUsd: key.leftUsd,
        needUsd,
        resetsAt: key.resetsAt ? new Date(key.resetsAt) : null,
        allowance: null,
      };
    return null;
  } catch {
    return null;
  }
}

/** "at 00:00 UTC" today, or "on 16 Nov at 00:00 UTC" for a later day; "" when unknown. */
export function comesBack(resetsAt: Date | string | null): string {
  if (!resetsAt) return "";
  const at = typeof resetsAt === "string" ? new Date(resetsAt) : resetsAt;
  const time = `${at.toISOString().slice(11, 16)} UTC`;
  const sameDay = at.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);
  const tomorrow = at.getTime() - Date.now() < 24 * 3600_000;
  if (sameDay || tomorrow) return `at ${time}`;
  return `on ${at.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })} at ${time}`;
}

/** Whose allowance an end user id is, as a person reads it. */
function whose(endUserId: string | null): string {
  if (!endUserId) return "Teire's";
  if (endUserId.startsWith(END_USERS.person.prefix)) return "Your";
  if (endUserId.startsWith(END_USERS.installation.prefix)) return "This installation's";
  if (endUserId === END_USERS.operator.id) return "The operator walk's";
  return "Teire's shared";
}

const dollars = (n: number) => `$${n.toFixed(n > 0 && n < 0.1 ? 3 : 2)}`;

/**
 * What a person reads when work can't start: whose allowance, what is left against what the work
 * needs to start, and when it comes back.
 */
export function refusalSaid(r: StartRefusal, endUserId: string | null): string {
  const back = comesBack(r.resetsAt);
  const when = back ? `; it comes back ${back}` : "";
  const left = r.leftUsd ?? 0;
  if (r.scope === "key")
    return `Teire's overall AI budget on Otari has ${dollars(left)} left, less than this needs to start (${dollars(r.needUsd)})${when}.`;
  if (r.blocked) return `${whose(endUserId)} AI allowance is paused on Otari by Teire's operator.`;
  const limit = r.allowance?.limitUsd;
  if (left <= 0.0005)
    return `${whose(endUserId)} AI allowance is used up${limit ? ` (${dollars(limit)} spent)` : ""}${when}.`;
  return `${whose(endUserId)} AI allowance has ${dollars(left)}${limit ? ` of ${dollars(limit)}` : ""} left, less than this needs to start (${dollars(r.needUsd)})${when}.`;
}
