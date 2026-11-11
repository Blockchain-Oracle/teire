import { generateText, Output } from "ai";
import { z } from "zod";
import { DISCOVERY } from "../constants";
import { createGateway, endUsers, type Gateway, receiptOf } from "../gateway";

/**
 * Web search and fetch through Otari (`POST /api/v1/search`, `/api/v1/fetch`), for providers with no
 * hand-written reader. Search only nominates pages: every URL it returns is checked against the
 * provider's allowlist and fetched again by Teire before anything is read from it. Fetch is the
 * fallback for a page whose own HTML holds no text (rendered by script).
 *
 * A deployment with no search provider of its own (otari.ai) refuses `POST /search` but runs the
 * built-in `otari_web_search` tool inside a model call, so search falls back to that once and stays
 * there: the reader runs one search restricted to the same domains and lists what it returned.
 *
 * Discovery is shared work (one provider's pages serve every repository that uses it), so a service
 * key bills searches and fetches to Teire's catalog end user; an ordinary key (the CLI) names nobody.
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

let gateway: Gateway | null = null;
const catalog = () => {
  gateway ??= createGateway();
  return gateway.as(endUsers.catalog);
};

/** Set once `POST /search` answers that the deployment has no search provider. */
let directSearch = true;

const SearchList = z.object({
  results: z.array(z.object({ url: z.string(), title: z.string() })).max(DISCOVERY.search.maxResults),
});

export async function webSearch(
  query: string,
  includeDomains: string[],
): Promise<{ results: WebSearchResult[]; usage: WebUsage }> {
  const started = Date.now();
  const ai = await catalog();
  // Otari takes at most 20 domains; the provider's own come first in the list.
  const domains = includeDomains.slice(0, DISCOVERY.search.maxDomains);
  if (directSearch) {
    try {
      const data = await ai.rest.search(
        {
          query,
          max_results: DISCOVERY.search.maxResults,
          search_domain_filter: domains,
          ...(ai.billing.user ? { user: ai.billing.user } : {}),
        },
        AbortSignal.timeout(DISCOVERY.search.timeoutMs),
        ai.billing.headers,
      );
      return {
        results: data.results.map((r) => ({ url: r.url, title: r.title ?? "" })),
        usage: { endpoint: "search", requestId: data.requestId, ms: Date.now() - started },
      };
    } catch (error) {
      if (!/no search tools are configured/i.test(String(error))) throw error;
      directSearch = false;
    }
  }
  const result = await generateText({
    ...ai.call("reader", {
      purpose: "discover-search",
      otariTools: [
        {
          type: "otari_web_search",
          max_uses: 1,
          max_results: DISCOVERY.search.maxResults,
          allowed_domains: domains,
        },
      ],
    }),
    output: Output.object({ schema: SearchList }),
    maxOutputTokens: DISCOVERY.search.listMaxTokens,
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(DISCOVERY.search.timeoutMs),
    prompt:
      `Run one web search for: ${query}\n` +
      "List the results the search returned, each with its exact URL and title, best first. " +
      "Copy URLs exactly; never write a URL the search did not return.",
  });
  return {
    results: result.output.results,
    usage: { endpoint: "search", requestId: receiptOf(result).requestId ?? null, ms: Date.now() - started },
  };
}

export async function webFetch(url: string): Promise<{ content: string | null; usage: WebUsage }> {
  const started = Date.now();
  const { rest, billing } = await catalog();
  const data = await rest.fetch(
    { url, max_chars: DISCOVERY.search.fetchMaxChars, ...(billing.user ? { user: billing.user } : {}) },
    AbortSignal.timeout(DISCOVERY.search.timeoutMs),
    billing.headers,
  );
  return {
    content: data.text || null,
    usage: { endpoint: "fetch", requestId: data.requestId, ms: Date.now() - started },
  };
}
