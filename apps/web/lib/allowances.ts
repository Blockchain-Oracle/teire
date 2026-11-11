import "server-only";
import {
  type Allowance,
  allowanceOf,
  endUsers,
  type KeyAllowance,
  keyAllowance,
} from "@teire/engine/gateway";
import { cache } from "react";
import { gateway, viewerAi } from "./gateway";

/**
 * Allowances as Otari reports them, once per request (React `cache`). Otari is the only ledger: these
 * read the end user's budget, spend, held amount and reset time from the service key's end users. A
 * read that fails gives null and the meter says Otari didn't answer; work is still capped by Otari.
 */

/** A person's own allowance: Ask Teire, public scans and dry runs. Null without a service key. */
export const personAllowance = cache(async (userId: string): Promise<Allowance | null> => {
  const ai = await viewerAi(userId);
  if (!ai.endUser) return null;
  return allowanceOf(ai.rest, ai.endUser).catch(() => null);
});

/** An installation's allowance: its scans, fix runs, CI repairs and re-verifies. */
export const installationAllowance = cache(async (installationId: number): Promise<Allowance | null> => {
  const ai = await gateway().as(endUsers.installation(installationId));
  if (!ai.endUser) return null;
  return allowanceOf(ai.rest, ai.endUser).catch(() => null);
});

/** The service key's ceiling: everyone together. */
export const serviceAllowance = cache(async (): Promise<KeyAllowance | null> => {
  const ai = await gateway().as(null);
  return keyAllowance(ai.rest).catch(() => null);
});

/** The numbers a meter draws, small enough to pass to a client card. */
export interface MeterData {
  budget: string | null;
  spentUsd: number;
  heldUsd: number;
  limitUsd: number | null;
  leftUsd: number | null;
  resetsAt: string | null;
  blocked: boolean;
}

export const meterOf = (a: Allowance | null): MeterData | null =>
  a && {
    budget: a.budget,
    spentUsd: a.spentUsd,
    heldUsd: a.heldUsd,
    limitUsd: a.limitUsd,
    leftUsd: a.leftUsd,
    resetsAt: a.resetsAt,
    blocked: a.blocked,
  };
