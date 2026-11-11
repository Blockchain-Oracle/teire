import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { getChange, listChanges } from "@/lib/catalog";
import { searchDocs } from "@/lib/docs-search";

/**
 * Teire's public MCP server (S04), Streamable HTTP and stateless: the change catalog (API and model
 * retirements, breaking releases, each with its quoted source) and Teire's docs, read-only. Otari's
 * MCP loop calls it for Ask Teire's docs mode, and any MCP client can add it by URL.
 */
const SHOWN = 40;

const text = (value: unknown) => ({
  content: [
    { type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) },
  ],
});

function server() {
  const mcp = new McpServer({ name: "teire", version: "1.0.0" });
  mcp.registerTool(
    "list_changes",
    {
      title: "List public changes",
      description:
        "Confirmed changes Teire has read: API deprecations and shutdowns, model retirements, breaking package releases, upcoming shutdowns first. Every record carries the exact source quote it was confirmed against.",
      inputSchema: {
        provider: z
          .string()
          .optional()
          .describe("Provider or ecosystem slug (openai, anthropic, stripe, npm…)"),
        kind: z.string().optional().describe("Change kind, e.g. model-retirement, endpoint-removal"),
        subject: z.string().optional().describe("Words in the title: a package, model or endpoint name"),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ provider, kind, subject }) => {
      const words = subject?.toLowerCase().split(/\s+/).filter(Boolean) ?? [];
      const rows = (await listChanges()).filter(
        (r) =>
          (!provider || r.provider === provider) &&
          (!kind || r.kind === kind) &&
          words.every((w) => r.title.toLowerCase().includes(w)),
      );
      return text({
        total: rows.length,
        changes: rows.slice(0, SHOWN).map((r) => ({
          id: r.id,
          provider: r.provider,
          kind: r.kind,
          title: r.title,
          deadline: r.deadline ? new Date(r.deadline).toISOString().slice(0, 10) : null,
        })),
        ...(rows.length > SHOWN ? { more: `${rows.length - SHOWN} more; narrow with subject or kind` } : {}),
      });
    },
  );
  mcp.registerTool(
    "get_change",
    {
      title: "Get a change",
      description:
        "One change by id: what it applies to, the replacement, migration notes and its quoted sources.",
      inputSchema: { id: z.string().describe("Change id from list_changes") },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ id }) => {
      const record = await getChange(id);
      return record
        ? text(record)
        : { ...text(`No change with id ${id}; ids come from list_changes.`), isError: true };
    },
  );
  mcp.registerTool(
    "search_docs",
    {
      title: "Search Teire's docs",
      description:
        "How Teire works: installing, configuration (teire.yml), fix mode, verification, ecosystems, allowances on Otari.",
      inputSchema: { query: z.string().min(2).max(200) },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ query }) => text(await searchDocs(query)),
  );
  return mcp;
}

async function handle(request: Request) {
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server().connect(transport);
  return transport.handleRequest(request);
}

export { handle as DELETE, handle as GET, handle as POST };
