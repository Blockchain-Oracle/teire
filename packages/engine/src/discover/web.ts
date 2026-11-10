import { DISCOVERY, END_USERS } from "../constants";
import { createOtariRest, gatewayConfigFromEnv, type OtariRest } from "../gateway";

/**
 * Web search and fetch through Otari (`POST /api/v1/search`, `/api/v1/fetch`), for providers with no
 * hand-written reader. Search only nominates pages: every URL it returns is checked against the
 * provider's allowlist and fetched again by Teire before anything is read from it. Fetch is the
 * fallback for a page whose own HTML holds no text (rendered by script).
 *
 * Discovery is shared work (one provider's pages serve every repository that uses it), so a service
 * key bills searches to Teire's catalog end user; an ordinary key (the CLI) names no end user.
 */
export interface WebUsage {
  endpoint: "search" | "fetch";
  /** Otari's id for the call: its usage row and settled cost. */
  requestId: string | null;
  ms: number;
}

export interface WebSearchResult {
  url: string;
  title: string;
}

let rest: OtariRest | null = null;
const client = () => {
  rest ??= createOtariRest(gatewayConfigFromEnv());
  return rest;
};
const catalogUser = () => (process.env.OTARI_SERVICE_KEY ? { user: END_USERS.catalog.id } : {});

export async function webSearch(
  query: string,
  includeDomains: string[],
): Promise<{ results: WebSearchResult[]; usage: WebUsage }> {
  const started = Date.now();
  const data = await client().search(
    {
      query,
      max_results: DISCOVERY.search.maxResults,
      // Otari takes at most 20 domains; the provider's own come first in the list.
      search_domain_filter: includeDomains.slice(0, DISCOVERY.search.maxDomains),
      ...catalogUser(),
    },
    AbortSignal.timeout(DISCOVERY.search.timeoutMs),
  );
  return {
    results: data.results.map((r) => ({ url: r.url, title: r.title ?? "" })),
    usage: { endpoint: "search", requestId: data.requestId, ms: Date.now() - started },
  };
}

export async function webFetch(url: string): Promise<{ content: string | null; usage: WebUsage }> {
  const started = Date.now();
  const data = await client().fetch(
    { url, max_chars: DISCOVERY.search.fetchMaxChars },
    AbortSignal.timeout(DISCOVERY.search.timeoutMs),
  );
  return {
    content: data.text || null,
    usage: { endpoint: "fetch", requestId: data.requestId, ms: Date.now() - started },
  };
}
