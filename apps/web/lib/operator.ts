import "server-only";
import { account, and, eq, installations, user } from "@teire/db";
import { END_USERS } from "@teire/engine/constants";
import { allowanceOf, endUsers } from "@teire/engine/gateway";
import { cache } from "react";
import { database } from "./db";
import { gateway } from "./gateway";

/**
 * Teire's operators: the GitHub accounts named in `TEIRE_OPERATOR_GITHUB_IDS` (comma-separated
 * numeric ids, which never change when a login is renamed). They see every allowance on Otari and
 * can move an end user to another of the key's budgets or pause it.
 */
export const isOperator = cache(async (userId: string): Promise<boolean> => {
  const ids = (process.env.TEIRE_OPERATOR_GITHUB_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!ids.length) return false;
  const [row] = await database()
    .select({ id: account.accountId })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "github")))
    .limit(1);
  return Boolean(row && ids.includes(row.id));
});

/** One end user as the operator reads it: who it is in Teire's words, and its allowance now. */
export interface OperatorRow {
  externalId: string;
  who: string;
  kind: "person" | "installation" | "shared";
  budget: string | null;
  spentUsd: number;
  heldUsd: number;
  limitUsd: number | null;
  blocked: boolean;
  resetsAt: string | null;
}

/** Every end user of the service key with its budget, plus the budgets it may be moved to. */
export async function operatorView() {
  const rest = (await gateway().as(null)).rest;
  const [list, budgets] = await Promise.all([rest.endUsers(), rest.endUserBudgets()]);
  const byId = new Map(budgets.map((b) => [b.budget_id, b]));
  const db = database();
  const [people, insts] = await Promise.all([
    db
      .select({ id: account.accountId, name: user.name })
      .from(account)
      .innerJoin(user, eq(user.id, account.userId))
      .where(eq(account.providerId, "github")),
    db.select({ id: installations.id, login: installations.accountLogin }).from(installations),
  ]);
  const names = new Map<string, string>([
    ...people.map((p) => [`${END_USERS.person.prefix}${p.id}`, p.name] as const),
    ...insts.map((i) => [`${END_USERS.installation.prefix}${i.id}`, i.login] as const),
  ]);
  const rows: OperatorRow[] = list.map((u) => {
    const b = u.budget_id ? byId.get(u.budget_id) : undefined;
    const lapsed = Boolean(u.next_budget_reset_at && Date.parse(u.next_budget_reset_at) <= Date.now());
    return {
      externalId: u.external_id,
      who: names.get(u.external_id) ?? u.external_id,
      kind: u.external_id.startsWith(END_USERS.person.prefix)
        ? "person"
        : u.external_id.startsWith(END_USERS.installation.prefix)
          ? "installation"
          : "shared",
      budget: b?.name ?? null,
      spentUsd: lapsed ? 0 : u.spend,
      heldUsd: lapsed ? 0 : u.reserved,
      limitUsd: b?.max_budget ?? null,
      blocked: u.blocked,
      resetsAt: lapsed ? null : u.next_budget_reset_at,
    };
  });
  // People and installations that signed in or installed but haven't made a call yet: Otari creates
  // them at their first call, on their default budget, so they can be put on another budget first.
  const seen = new Set(rows.map((r) => r.externalId));
  const waiting = [...names.entries()]
    .filter(([id]) => !seen.has(id))
    .map(([id, who]) => ({ externalId: id, who }));
  return {
    rows,
    waiting,
    budgets: budgets.map((b) => ({
      id: b.budget_id,
      name: b.name ?? b.budget_id,
      maxUsd: b.max_budget ?? null,
      period: b.reset_alignment ?? null,
      endUsers: b.end_user_count ?? 0,
      isDefault: b.is_default ?? false,
    })),
  };
}

/** The allowance of one end user by its id (`gh:…`, `inst:…`), for a check after a move. */
export async function allowanceById(externalId: string) {
  const ai = await gateway().as(null);
  const budget = externalId.startsWith(END_USERS.installation.prefix)
    ? END_USERS.installation.budget
    : END_USERS.person.budget;
  return allowanceOf(ai.rest, { id: externalId, budget });
}

export { endUsers };
