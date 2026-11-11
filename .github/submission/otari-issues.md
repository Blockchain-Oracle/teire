# Issue drafts for mozilla-ai/otari

From [docs/otari-feedback.md](../../docs/otari-feedback.md). Each is ready to paste as a new issue on
https://github.com/mozilla-ai/otari/issues; the owner files them and adds the links to item 5 of
[fields.md](fields.md).

---

## 1. Guardrail refusals have no `Otari-Error-Code` header and aren't in the error table

**What happens.** A block-mode guardrail refusal is a 403 whose code is nested at `detail.code`
(`guardrail_violation`), with no `Otari-Error-Code` header (`src/gateway/api/routes/_helpers.py`).
Every other refusal carries a top-level `code` and the header, and the error-code table in
`docs/api-reference.md` doesn't list `guardrail_violation`.

**Why it matters.** A client that maps errors by `Otari-Error-Code`, as the docs recommend, treats a
guardrail block as an unknown 403.

**Reproduce.** Send any chat completion with `"guardrails": [{"profile": "<profile>", "url": "<a
service that answers valid:false>", "mode": "block"}]` and read the response headers.

**Suggested.** Set `Otari-Error-Code: guardrail_violation` and list it in the table.

---

## 2. Rune is listed as a decision model on otari.ai but `/systemone` serves no provider

**What happens.** On api.otari.ai, `GET /api/v1/models` lists `surogate/rune-26b-a4b` with
`type: decision`, and the catalog lists `/systemone` among the endpoints of
`fireworks:accounts/fireworks/models/rune`. `POST /api/v1/systemone` refuses all three spellings with
400 "does not name a configured decision provider. Use '<provider>:<model>' with one of: none."
`/messages` answers "This model only serves /v1/systemone"; `/responses` answers 424.

**Suggested.** Either configure the decision provider the catalog lists, or leave decision models out
of the hosted listing until one is configured.

---

## 3. `GET /tools` says web search is available while `POST /search` says no search tool is configured

**What happens.** With web search allowed for the workspace, `GET /api/v1/tools` lists
`otari_web_search` with `available: true`, and the tool works inside a chat completion. `POST
/api/v1/search` answers 400 "No search tools are configured. Add one on the dashboard's Tools &
Guardrails page". The direct route needs an organization search instance
(`services/tools/_web_search/_direct.py`), the built-in tool runs on the deployment's own.

**Suggested.** Let the direct route fall back to the deployment's search like the built-in tool does,
or have `/tools` report the direct route's availability separately.

---

## 4. An unknown model or policy name answers only "Unknown or unsupported model"

**What happens.** Calls to `teire-fixer` answered "Unknown or unsupported model 'teire-fixer'" for
every key of the organization. We read that as a policy the key couldn't see, since policies resolve
only in the key's workspace (`services/policy_store.py`); in fact the key's workspace, the
organization's only one, held no policies at all. The 400 reads the same whether the name is a
policy in another workspace, a policy that doesn't exist, or a model the catalog lacks, and only
`GET /api/v1/models` (which lists policies beside the models) told us which.

**Suggested.** Make the 400 say which workspace it looked in: "no model, alias or routing policy
named 'teire-fixer' in workspace 'Default workspace'".

---

## 5. An end user's remaining budget and next reset aren't readable in one place

**What happens.** A service key reads `spend` and `reserved` from `/end-users` and `max_budget` from
`/end-user-budgets`, then has to subtract and work out the next calendar boundary itself, including
for an end user that hasn't made a call yet (no `next_budget_reset_at`).

**Suggested.** Add `remaining_usd` and `resets_at` to `EndUserPublic`, and let `GET /end-users` answer
for an `external_id` that doesn't exist yet with the key's default budget.
