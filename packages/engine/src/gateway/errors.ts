/**
 * Otari's refusals as typed errors (contract: context/02-otari-api-and-integrations/gateway-contract-for-teire.md
 * §A.5). Otari answers `{detail, code, end_user?}` with `Otari-Error-Code`, `Otari-Budget-Scope` and
 * `Retry-After` headers, not OpenAI's error shape, so they are read here, before the AI SDK sees the
 * response: a typed error is not one the SDK retries, which is right for every one of these.
 */

/** Who a spent budget belonged to (`Otari-Budget-Scope`): `user` is an end user, `api_token` the key's ceiling. */
export type BudgetScope =
  | "user"
  | "api_token"
  | "organization"
  | "workspace"
  | "workspace_member"
  | "org_member";

/** 403 `budget_exceeded`: an end user's allowance, or the whole service's ceiling, is used up. */
export class BudgetExceededError extends Error {
  readonly scope: BudgetScope | null;
  readonly endUser: string | null;
  /** Seconds until the budget's next window, when a fresh window would fit the request. */
  readonly retryAfterSec: number | null;
  readonly requestId: string | null;
  constructor(
    detail: string,
    init: {
      scope: string | null;
      endUser: string | null;
      retryAfterSec: number | null;
      requestId: string | null;
    },
  ) {
    super(detail);
    this.name = "BudgetExceededError";
    this.scope = (init.scope as BudgetScope | null) ?? null;
    this.endUser = init.endUser;
    this.retryAfterSec = init.retryAfterSec;
    this.requestId = init.requestId;
  }
  /** When the allowance comes back, if Otari said. */
  resetsAt(now = Date.now()) {
    return this.retryAfterSec == null ? null : new Date(now + this.retryAfterSec * 1000);
  }
}

export interface GuardrailFinding {
  profile: string;
  explanation?: string;
  score?: number;
}

/** 403 with `detail.code: guardrail_violation`: a block-mode guardrail refused the request. */
export class GuardrailBlockedError extends Error {
  readonly guardrails: GuardrailFinding[];
  readonly requestId: string | null;
  constructor(message: string, guardrails: GuardrailFinding[], requestId: string | null) {
    super(message);
    this.name = "GuardrailBlockedError";
    this.guardrails = guardrails;
    this.requestId = requestId;
  }
}

/** 502 "guardrail profile '…' could not be evaluated": a block-mode check could not run, so nothing was sent. */
export class GuardrailUnavailableError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = "GuardrailUnavailableError";
  }
}

/** 402 (`insufficient_funds`, `pricing_required`): the organization's balance can't pay for the call. */
export class BalanceExhaustedError extends Error {
  readonly code: string | null;
  constructor(detail: string, code: string | null) {
    super(`Otari balance: ${detail}`);
    this.name = "BalanceExhaustedError";
    this.code = code;
  }
}

/** Any other refusal Otari names with a code: a blocked end user, an end-user cap, a model not allowed. */
export class GatewayRefusedError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, detail: string) {
    super(`${detail} (${code})`);
    this.name = "GatewayRefusedError";
    this.status = status;
    this.code = code;
  }
}

/** The service has no Otari key, so no model work can run. */
export class GatewayNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GatewayNotConfiguredError";
  }
}

/** A refusal that pauses work until money or allowance comes back, rather than failing it. */
export const isAllowanceRefusal = (error: unknown): error is BudgetExceededError | BalanceExhaustedError =>
  error instanceof BudgetExceededError || error instanceof BalanceExhaustedError;

/** Codes that are refusals of this caller, not faults to retry. */
const REFUSAL_CODES = new Set([
  "user_blocked",
  "end_user_limit_reached",
  "end_user_budget_not_allowed",
  "model_not_allowed",
  "invalid_model",
]);

const text = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : JSON.stringify(v));

/** The typed error for a refused response, or null when the AI SDK should handle it as usual. */
export async function refusalOf(res: Response): Promise<Error | null> {
  if (res.ok || ![400, 402, 403, 502].includes(res.status)) return null;
  const body = (await res
    .clone()
    .json()
    .catch(() => null)) as { detail?: unknown; code?: unknown; end_user?: unknown } | null;
  const detail = body?.detail;
  const code = res.headers.get("otari-error-code") ?? (typeof body?.code === "string" ? body.code : null);
  const requestId = res.headers.get("otari-request-id");
  if (res.status === 403 && code === "budget_exceeded") {
    const retry = Number(res.headers.get("retry-after"));
    return new BudgetExceededError(text(detail) || "budget exceeded", {
      scope: res.headers.get("otari-budget-scope"),
      endUser: typeof body?.end_user === "string" ? body.end_user : null,
      retryAfterSec: Number.isFinite(retry) && retry > 0 ? retry : null,
      requestId,
    });
  }
  // A guardrail block nests its code under `detail` and sends no Otari-Error-Code header.
  const nested =
    detail && typeof detail === "object"
      ? (detail as { code?: unknown; message?: unknown; guardrails?: unknown })
      : null;
  if (res.status === 403 && nested?.code === "guardrail_violation")
    return new GuardrailBlockedError(
      text(nested.message) || "Request blocked by guardrail policy.",
      Array.isArray(nested.guardrails) ? (nested.guardrails as GuardrailFinding[]) : [],
      requestId,
    );
  if (res.status === 502 && /guardrail profile .* could not be evaluated/i.test(text(detail)))
    return new GuardrailUnavailableError(text(detail));
  if (res.status === 402) return new BalanceExhaustedError(text(detail) || "insufficient funds", code);
  if (code && REFUSAL_CODES.has(code)) return new GatewayRefusedError(res.status, code, text(detail));
  return null;
}

/** The client's fetch: refusals become typed errors; everything else (429/5xx) is left to the SDK's retries. */
export function gatewayFetch(base: typeof fetch = fetch): typeof fetch {
  return (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const res = await base(input, init);
    const refused = await refusalOf(res);
    if (refused) throw refused;
    return res;
  }) as typeof fetch;
}
