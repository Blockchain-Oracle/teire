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
6. **Decisions on otari.ai are listed but not served.** `GET /api/v1/models` lists
   `surogate/rune-26b-a4b` as `type: decision`, and the catalog lists `/systemone` among the endpoints
   of `fireworks:accounts/fireworks/models/rune` and `…/routers/rune`. On 2026-11-10 `POST
   /api/v1/systemone` refused all three spellings with 400 "does not name a configured decision
   provider. Use '<provider>:<model>' with one of: none." `/messages` answers "This model only serves
   /v1/systemone", and `/responses` answers 424 `provider_credential_rejected`. So the decision model
   can't be reached on the hosted deployment; either the catalog shouldn't list it, or
   `decision_providers` should include the provider it lists.

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
12. **`/tools` says search is available, `/search` says no search tool is configured.** After web
    search was switched on (2026-11-11), `GET /api/v1/tools` lists `otari_web_search` as available,
    and the tool works inside a chat call, but `POST /api/v1/search` answers 400 "No search tools are
    configured. Add one on the dashboard's Tools & Guardrails page". The direct route needs an
    organization search provider (`pick_direct_search_instance`); the built-in tool runs on the
    deployment's own. Teire now falls back to the built-in tool when the direct route says so
    (`discover/web.ts`). `/fetch` has no such split: it answers directly.
13. **An unknown policy name answers only "Unknown or unsupported model".** Calls to `teire-fixer` on
    2026-11-11 answered "Unknown or unsupported model" for every key of the organization (the service
    key, an older service key, an ordinary key), and `GET /api/v1/models`, which lists aliases and
    policies beside the models, showed none. We took it for a policy saved in another workspace; on
    signing in, the organization's only workspace held no policies, and the six were created there and
    resolved at once (`scripts/otari-offerings.ts --policies`, all six `ok`, `teire-fallback-check`
    with `Otari-Fallback: true` after two attempts). The 400 could say which workspace it looked in, so
    "doesn't exist here" and "exists elsewhere" read differently.

## Worked well

- One OpenAI-compatible base URL served all five of Teire's open-weight models, with structured
  output, on the first try; `Otari-Model` and `Otari-Provider` say exactly what answered.
- `usage.cost_usd` on every response made Teire's own price list unnecessary; we deleted it.
- The error contract (`Otari-Error-Code`, `Otari-Budget-Scope`, `Retry-After`) maps cleanly onto
  typed errors and a "comes back at" time.
- Mixing caller function tools with Otari's own tools in one request is supported (`mcp_loop.py`).
