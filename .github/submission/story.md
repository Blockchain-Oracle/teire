# Teire · 手入れ

**When upstream breaks, Teire fixes your code.** Open-weight models on Otari find the code a package,
API or AI-model change breaks, fix it, and prove the fix with your own tests.

## The problem

Every app leans on things other people change: open-source packages, payment APIs, AI models. When
one of them changes, someone has to notice it, work out whether it touches their code, find every
line that does, change those lines, and prove the app still works. Nobody owns this chore, so it
waits until something breaks.

On 2026-10-23 OpenAI shut down `gpt-3.5-turbo` and `gpt-4`. That day seven of inspect_ai's live tests
failed with `404 model_not_found`; the next morning the commit tool gitted failed on every call. The
notice existed six months earlier; nothing connected it to the code. Dependabot and Renovate bump a
version and leave the breakage to you, and a retired model isn't a version, so they open nothing.

## What Teire does

Teire watches the packages, APIs and AI models a repository uses. When one changes, it finds the
exact lines the change reaches, fixes them, runs your own checks before and after in a sandbox with
the network off, and opens a pull request with the quotes, the call sites, the verification table
and every model call's cost. Your job becomes reviewing a pull request.

Every model call goes through **Otari**, Mozilla.ai's AI gateway, and five open-weight models do five
jobs: **GLM 5.3** fixes code, **DeepSeek V4 Pro** reviews it, **DeepSeek V4.1 Flash** reads release
notes and provider pages, **MiniMax M3** researches a change before the fix, and **gpt-oss-120b**
answers questions in Ask Teire.

## One change, end to end

[teire-demo-bristow](https://github.com/Blockchain-Oracle/teire-demo-bristow), a Ruby agent framework,
still used `gpt-3.5-turbo` and `gpt-4` 29 times. Teire read OpenAI's deprecations page (each record
kept only if its quote appears word for word), made 31 swaps to the replacements OpenAI names, and saw
one spec still fail. GLM 5.3 found the cause, a test class still declaring the old model, in 6 steps
for $0.046. DeepSeek V4 Pro reviewed the diff ($0.0074). 143/143 tests passed before and after, with
every network request refused. [Pull request #8](https://github.com/Blockchain-Oracle/teire-demo-bristow/pull/8)
opened ready, model total $0.053, billed by Otari to that installation's own allowance.

## How Teire uses Otari

- **Per-user budgets.** Every call names who it is for, as an end user of Teire's service key: each
  signed-in person ($0.50 a day), each GitHub App installation ($3 a day), Teire's shared catalog
  reader. Before work starts Teire reads the payer's allowance from Otari; a person who runs out is
  told when it comes back, a fix run waits for its installation's reset, and nobody else stops. The
  operator moves or pauses anyone from Settings › Allowances.
- **Budgets and spending limits.** A ceiling on the whole key, shown live on the trust page; Otari's
  refusals become typed errors with a reset time.
- **Routing and fallbacks.** Each role sends a catalog id; Otari picks the host and falls back across
  up to five, and the receipt names the host and any fallback. One `Otari-Conversation-Id` per fix
  run keeps it on one host so the prompt cache is reused.
- **Web search and fetch, MCP, code execution.** Before the fixer starts, the researcher reads the
  change in Otari's own tool loop: web search, web fetch, and the target's docs through Context7 over
  MCP. For a Python package it installs both versions in Otari's code sandbox and prints the
  signatures the code calls. Teire also serves its own change catalog over MCP (`/api/mcp`) for Ask
  Teire's docs mode.
- **Guardrails.** Release notes, vendor pages and the research brief name a prompt-injection
  guardrail in block mode; Otari runs it before any model reads them. A demo repository plants an
  instruction to the AI in a changelog: on the zod run Otari refused it ("Changelog 4.0.0"), Teire
  read zod's 55 other sources without it, and PR #25 upgraded zod with 4/4 tests passing
  (https://teire.84.46.247.92.sslip.io/runs/d522ac54-682c-4571-9c7d-4222ebee5b0e).

## Proof

- PRs opened through Otari on four public demo repositories: bristow
  [#8](https://github.com/Blockchain-Oracle/teire-demo-bristow/pull/8) and
  [#7](https://github.com/Blockchain-Oracle/teire-demo-bristow/pull/7) (retired OpenAI and Anthropic
  models), nlsh [#2](https://github.com/Blockchain-Oracle/teire-demo-nlsh/pull/2) (17 advisories),
  serve-handler [#15](https://github.com/Blockchain-Oracle/teire-demo-serve-handler/pull/15), examples
  [#5](https://github.com/Blockchain-Oracle/teire-demo-examples/pull/5) and
  [#25](https://github.com/Blockchain-Oracle/teire-demo-examples/pull/25) (zod 3 → 4, with Otari's
  guardrail refusing a planted changelog on the way).
- The models were chosen by measuring six open-weight models on Teire's own fix and extraction jobs
  through Otari ([Evaluation](https://teire.84.46.247.92.sslip.io/docs/otari/evaluation)).
- Live app: https://teire.84.46.247.92.sslip.io · docs: https://teire.84.46.247.92.sslip.io/docs/otari
  · status: https://teire.84.46.247.92.sslip.io/trust

## Built with

Otari (Mozilla.ai), GLM 5.3, DeepSeek V4 Pro, DeepSeek V4.1 Flash, MiniMax M3, gpt-oss-120b,
TypeScript, Next.js, the AI SDK, PostgreSQL, pg-boss, Drizzle, the Model Context Protocol SDK,
Cloudflare Containers, GitHub Apps, Coolify.

## Honest limits

Routing policies were drafted but saved in another workspace than Teire's key, so roles use Otari's
automatic provider selection; MCP by URL needs one workspace switch; otari.ai serves no request-level
guardrail profile, so the guardrail is Teire's own service run by Otari; code proof covers Python
packages only.
