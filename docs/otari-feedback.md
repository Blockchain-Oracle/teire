# Otari feedback log

What we ran into while moving Teire onto Otari: doc contradictions, rough edges and things that
worked well. Each entry says where we saw it, so it can become an issue on `mozilla-ai/otari` (each
issue is drafted from here and approved before it is posted). Source references point at the
`mozilla-ai/otari` checkout at `8f096bb` (2026-11-09) and at docs.otari.ai as read on 2026-11-10.

## Doc and code disagree

1. **Chat Completions docstring on `user` is out of date.** The route's docstring (and so the
   OpenAPI description of `POST /api/v1/chat/completions`) says "API key + user field: use specified
   user (must exist); API key without user field: use the shared default user". The code binds spend
   to the key's own user and refuses any other `user` with 403 (`_billed_user.py:76-84`), which
   `docs/api-reference.md:340-352` describes correctly. (`src/gateway/api/routes/chat.py:496-499`)
2. **`Otari-Guardrails` on streams.** `docs/guardrails.md:61-63` says a streamed response does not
   carry the header; `docs/guardrails-reference.md:45-47` and the code (`_pipeline.py:1413-1420`,
   `:6773`) put it on streams too.
3. **`guardrail_violation` is not where the error table says codes live.** A block-mode refusal is a
   403 whose code is nested at `detail.code`, with no `Otari-Error-Code` header
   (`_helpers.py:266-282`), while every other refusal carries a top-level `code` and the header. The
   error-code table in `docs/api-reference.md:1118-1145` doesn't list it. A client mapping errors by
   `Otari-Error-Code` (as the docs recommend) misses guardrail blocks.
4. **`/fetch` and end users.** The route docstring says a service key's `user` names an end user "as
   on chat completions" (`fetch.py:70-74`); `docs/end-users.md:84-87` lists only chat, responses,
   search and messages.
5. **402 in the Python SDK README** is described as "budget or credits exhausted"; the gateway refuses
   a spent budget with 403 `budget_exceeded` and uses 402 for `insufficient_funds` / `pricing_required`.
6. **Decisions on otari.ai.** The hosted catalog lists `/systemone` among the endpoints of
   `fireworks:accounts/fireworks/models/rune` (`surogate/rune-26b-a4b`), while the open-source router
   refuses any selector whose prefix isn't a configured decision provider (`_decisions.py:84-98`) and
   the hosted decisions page names only `typesafe` and `openrouter`. Which string to send is unclear.

## Rough edges

7. **Web tools are off on a new workspace.** `GET /api/v1/tools` answered `workspace_disabled` for
   `otari_web_search` and `otari_web_fetch` on a fresh account (code execution was on). The quickstart
   doesn't mention the switch; a request that declares them is refused until it is turned on.
8. **Two base URLs.** The dashboard's code snippet uses `https://otari.ai/api/v1`; the docs use
   `https://api.otari.ai/api/v1`. Both answer today. One documented base would avoid doubt.
9. **No "remaining for this end user" read.** A service key gets `spend` and `reserved` from
   `/end-users` and `max_budget` from `/end-user-budgets`, and computes the remainder itself; one
   field on `EndUserPublic` (remaining and reset time) would save every integrator the join.
10. **Reasoning models and small output limits.** `z-ai/glm-5.3` spent a 400-token limit on reasoning
    and returned no content (the AI SDK reports "No output generated"); with 6,000 it answered with
    2,910 output tokens. Not Otari's bug, but a per-model note in the catalog (typical reasoning
    tokens) would help pick limits.
11. **OpenAPI request schemas mark defaulted fields as required for generators.** `include_raw` on
    `SearchRequest` and `FetchRequest` has a default, and openapi-typescript makes it required in
    request types unless run with `--default-non-nullable false`.

## Worked well

- One OpenAI-compatible base URL served all five of Teire's open-weight models, with structured
  output, on the first try; `Otari-Model` and `Otari-Provider` say exactly what answered.
- `usage.cost_usd` on every response made Teire's own price list unnecessary; we deleted it.
- The error contract (`Otari-Error-Code`, `Otari-Budget-Scope`, `Retry-After`) maps cleanly onto
  typed errors and a "comes back at" time.
- Mixing caller function tools with Otari's own tools in one request is supported (`mcp_loop.py`).
