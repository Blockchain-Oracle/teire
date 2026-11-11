# Feedback on Otari

Written while moving Teire onto Otari (2026-11-10 to 11). Every point is reproducible; the full log,
with source references, is [docs/otari-feedback.md](../../docs/otari-feedback.md).

## Written feedback

**1. When were you most tempted to skip Otari and call the provider directly? What happened?**

Twice. First with the decision model: `GET /models` lists Rune (`surogate/rune-26b-a4b`) as a decision
model and the catalog lists `/systemone` for it, but on otari.ai `POST /systemone` refused every
spelling with "does not name a configured decision provider … one of: none", `/messages` said the
model only serves `/systemone`, and `/responses` answered 424. Install triage was meant to use it, so
calling the provider directly was the obvious way out. We kept triage on DeepSeek V4.1 Flash through
Otari instead.

Second with search: after web search was switched on, `GET /tools` listed `otari_web_search` as
available, but `POST /search` answered 400 "No search tools are configured". Teire used to call a
search API directly for exactly this job. Reading Otari's source showed the direct route needs an
organization search provider while the built-in tool runs on the deployment's own, so Teire now runs
the built-in tool inside one model call when the direct route refuses, and stayed on Otari.

**2. What did you end up building yourself that Otari should've done for you?**

- **"What is left for this end user, and when does it reset?"** A service key gets `spend` and
  `reserved` from `/end-users` and `max_budget` from `/end-user-budgets`; Teire joins them, subtracts,
  and works out the next calendar boundary itself for an end user that hasn't made a call yet. One
  `remaining_usd` and `resets_at` on the end user would save every integrator that code.
- **A prompt-injection guardrail service.** otari.ai answers "No guardrails service is configured"
  for request-level profiles, so Teire hosts its own (`/api/guardrails`, Otari's contract) and names
  it per request. Otari runs it well; a hosted `prompt-injection` profile would make that unnecessary.
- **Refusal mapping for guardrails.** A block-mode refusal nests its code at `detail.code` and has no
  `Otari-Error-Code` header, unlike every other refusal, so it needs its own branch.
- **The search fallback** described above.

**3. If the rules hadn't required Otari, would you have continued using Otari? Why or why not?**

Yes. Moving to Otari deleted code: Teire's own price list (Otari's `usage.cost_usd` is on every
response), its retry and failover logic (catalog ids fall back across hosts by themselves), and its
own cost ledger and daily cap (a service key with end users gives every person and installation its
own allowance, enforced by the gateway, with a reset time on the refusal). One key reaches five
open-weight model families, and search, fetch, MCP and code execution run in the same loop as the
model, and one routing policy per role moves a person who is running low to a cheaper model before
they run out. What we'd ask for: an error that names the workspace when a model or policy name isn't
found (ours said only "Unknown or unsupported model"), the decision provider the catalog lists, and a
hosted guardrail profile.

## For the feedback recording

Spoken, 3–5 minutes, on screen:

1. **What did you build with Otari, and which features did you use?** Show the bristow PR receipt
   (GLM 5.3, DeepSeek V4 Pro), Otari's Routing page (one policy per role, each with a tier-down and
   backups), Settings › Allowances (per-person and per-installation budgets),
   the trust page's ceiling, a run's "Researcher read" list (web search and fetch), the guardrail
   refusing the planted zod changelog, `/api/mcp`.
2. **What worked well?** `usage.cost_usd` on every response; end users with budgets on a service
   key; typed refusals (`Otari-Budget-Scope`, `Retry-After`); one OpenAI-compatible URL for five
   model families with structured output; tools and model in one loop.
3. **What didn't work?** Rune listed but not served (`/systemone` "one of: none"); `/tools` says
   search is available while `/search` says no search tool is configured; an unknown policy name
   answers only "Unknown or unsupported model", without the workspace it looked in; MCP by URL off by
   default with no hint in the quickstart; web tools `workspace_disabled` on a fresh workspace.
4. **What's missing, and what would you change?** `remaining_usd` and `resets_at` on an end user; a
   hosted `prompt-injection` guardrail profile; the workspace shown beside a policy and the keys that
   can call it; `Otari-Error-Code` on guardrail refusals.
