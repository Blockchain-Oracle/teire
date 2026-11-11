import createClient from "openapi-fetch";
import { GATEWAY } from "../constants";
import { gatewayFetch } from "./errors";
import type { components, paths } from "./otari";

export type OtariSchemas = components["schemas"];
export type SearchResult = OtariSchemas["SearchResultItem"];
export type FetchedPage = OtariSchemas["FetchResponse"];
export type KeyBudget = OtariSchemas["KeyBudgetPublic"];
export type EndUserRecord = OtariSchemas["EndUserPublic"];
export type EndUserBudget = OtariSchemas["EndUserBudgetPublic"];

/**
 * Otari's REST endpoints that the chat client doesn't cover: search, fetch, code, budgets, settled
 * cost. Typed from Otari's own OpenAPI spec (scripts/otari-openapi.mjs keeps only these paths), and
 * refused the same way as chat calls (`gatewayFetch` turns refusals into typed errors).
 */
export function createOtariRest(config: { apiKey: string; baseURL: string }, fetchImpl?: typeof fetch) {
  const client = createClient<paths>({
    // The spec's paths carry `/api/v1`; the client's base is the origin.
    baseUrl: new URL(config.baseURL).origin,
    headers: { authorization: `Bearer ${config.apiKey}` },
    fetch: gatewayFetch(fetchImpl) as (input: Request) => Promise<Response>,
  });

  const fail = (what: string, response: Response, error: unknown): never => {
    const detail = (error as { detail?: unknown } | undefined)?.detail;
    throw new Error(
      `Otari ${what} answered ${response.status}: ${typeof detail === "string" ? detail : JSON.stringify(detail ?? error)}`,
    );
  };

  // End-user budgets by name (the dashboard's names, END_USERS), read again after GATEWAY.budgetsRefreshMs.
  let budgets: { read: Promise<Map<string, EndUserBudget>>; at: number } | null = null;

  return {
    client,

    /** Web search, billed to `user` when the key is a service key (discovery, the researcher). */
    async search(
      body: OtariSchemas["SearchRequest"],
      signal?: AbortSignal,
      headers?: Record<string, string>,
    ) {
      const { data, error, response } = await client.POST("/api/v1/search", { body, signal, headers });
      if (!data) return fail("search", response, error);
      return { ...data, requestId: response.headers.get("otari-request-id") };
    },

    /** One page as light Markdown (`max_chars` cuts it; `truncated` says so). */
    async fetch(body: OtariSchemas["FetchRequest"], signal?: AbortSignal, headers?: Record<string, string>) {
      const { data, error, response } = await client.POST("/api/v1/fetch", { body, signal, headers });
      if (!data) return fail("fetch", response, error);
      return { ...data, requestId: response.headers.get("otari-request-id") };
    },

    /** Python in Otari's sandbox (60 s at most): stdout, stderr, return code. */
    async execute(body: OtariSchemas["CodeExecuteRequest"], signal?: AbortSignal) {
      const { data, error, response } = await client.POST("/api/v1/code/execute", { body, signal });
      if (!data) return fail("code execution", response, error);
      return data;
    },

    /** Which managed tools this key may use right now (web fetch is off on some deployments). */
    async tools() {
      const { data, error, response } = await client.GET("/api/v1/tools");
      if (!data) return fail("tools", response, error);
      return data;
    },

    /** The key's own ceiling (for a service key, all end users together). */
    async keyBudget() {
      const { data, error, response } = await client.GET("/api/v1/key/budget");
      if (!data) return fail("key budget", response, error);
      return data;
    },

    /** One end user (`gh:…`, `inst:…`), or null before its first call. Service key only. */
    async endUser(externalId: string) {
      const { data, error, response } = await client.GET("/api/v1/end-users", {
        params: { query: { external_id: externalId } },
      });
      if (!data) return fail("end users", response, error);
      return data[0] ?? null;
    },

    /** Every end user of the service key, oldest first (the operator's allowances page). */
    async endUsers() {
      const { data, error, response } = await client.GET("/api/v1/end-users");
      if (!data) return fail("end users", response, error);
      return data;
    },

    /**
     * Put an end user on one of the key's budgets, creating it if needed (the operator raising or
     * lowering someone's allowance). On a calendar-aligned budget the period stays the calendar day,
     * so what it spent today carries over (checked 2026-11-11: $2.84 stayed after a move from $3 to $1).
     */
    async putEndUser(externalId: string, budgetId: string) {
      const { data, error, response } = await client.PUT("/api/v1/end-users", {
        params: { query: { external_id: externalId } },
        body: { budget_id: budgetId },
      });
      if (!data) return fail("end user", response, error);
      return data;
    },

    /** Pause an end user (Otari refuses its calls whatever is left) or let it work again. */
    async blockEndUser(externalId: string, blocked: boolean) {
      const { data, error, response } = await client.PATCH("/api/v1/end-users", {
        params: { query: { external_id: externalId } },
        body: { blocked },
      });
      if (!data) return fail("end user", response, error);
      return data;
    },

    /** The key's end-user budgets now, uncached, with how many end users each holds. */
    async endUserBudgets() {
      const { data, error, response } = await client.GET("/api/v1/end-user-budgets");
      if (!data) return fail("end-user budgets", response, error);
      return data;
    },

    /** The service key's end-user budgets, by name. */
    budgetsByName(): Promise<Map<string, EndUserBudget>> {
      if (budgets && Date.now() - budgets.at < GATEWAY.budgetsRefreshMs) return budgets.read;
      const read = (async () => {
        const { data, error, response } = await client.GET("/api/v1/end-user-budgets");
        if (!data) {
          budgets = null; // the next caller asks again
          return fail("end-user budgets", response, error);
        }
        return new Map(data.flatMap((b) => (b.name ? [[b.name, b] as const] : [])));
      })();
      budgets = { read, at: Date.now() };
      return read;
    },

    /** A call's cost once Otari has settled it (a stream that broke never reported one). */
    async settledCost(requestId: string) {
      const { data, response } = await client.GET("/api/v1/usage/requests/{request_id}", {
        params: { path: { request_id: requestId } },
      });
      if (response.status === 404 || !data) return null;
      return data;
    },
  };
}

export type OtariRest = ReturnType<typeof createOtariRest>;
