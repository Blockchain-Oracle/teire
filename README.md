<p align="center">
  <a href="https://teire.84.46.247.92.sslip.io">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset=".github/assets/banner-dark.png" />
      <source media="(prefers-color-scheme: light)" srcset=".github/assets/banner-light.png" />
      <img src=".github/assets/banner-dark.png" width="960" alt="Teire 手入れ. When upstream breaks, Teire fixes your code. Open-weight models on Otari find the code a package, API or AI-model change breaks, fix it, and prove the fix with your own tests." />
    </picture>
  </a>
</p>

<h1 align="center">Teire · 手入れ</h1>
<p align="center"><b>When upstream breaks, Teire fixes your code.</b><br />Open-weight models on Otari find the code a package, API or AI-model change breaks, fix it, and prove the fix with your own tests.</p>

<p align="center">
  <a href="https://teire.84.46.247.92.sslip.io"><b>Open the app</b></a>
  &nbsp;·&nbsp;
  <a href="#demo"><b>Demo</b></a>
  &nbsp;·&nbsp;
  <a href="https://teire.84.46.247.92.sslip.io/docs/otari"><b>Teire on Otari</b></a>
  &nbsp;·&nbsp;
  <a href="https://teire.84.46.247.92.sslip.io/docs"><b>Docs</b></a>
  &nbsp;·&nbsp;
  <a href="https://teire.84.46.247.92.sslip.io/trust"><b>Live status</b></a>
</p>

Teire watches the packages, APIs and AI models a repository depends on. When one of them changes, it finds the exact lines that break, fixes them, runs your own checks before and after in a sandbox, and opens a pull request with the proof. Every model call goes through **[Otari](https://otari.ai)**, Mozilla.ai's open-source AI gateway: five open-weight models do five different jobs (GLM 5.3 fixes code, DeepSeek V4 Pro reviews, DeepSeek V4.1 Flash reads, MiniMax M3 researches, gpt-oss-120b answers questions), each person and each repository spends from its own allowance on Otari, the researcher works in Otari's own web search, fetch, MCP and code-execution tools, and every page Teire reads passes a prompt-injection guardrail that Otari runs first.

You meet Teire in five places:
- a **GitHub App** that opens one pull request per change and keeps a Dashboard issue;
- **`@teire` commands** in issues and PRs;
- a **web dashboard** drawn as flows, with **Ask Teire** beside it, and **Settings › Allowances** showing what Otari lets each person and repository spend;
- a **public scan with a dry-run fix**, for any public repository;
- a **CLI and an MCP server** (`/api/mcp`) for terminals and coding agents.

Built for the **Mozilla Otari Hackathon – Devs Wilding Online** · **Build on Otari!** Jump to [how Teire meets the hackathon](#how-teire-meets-the-hackathon).

_Teire_ (手入れ) is Japanese for care and upkeep, the way you tend tools or a garden so they keep working.

## The problem

Every app leans on things other people change: open-source packages, payment APIs, AI models. When one of them changes, someone on the team has to:
1. notice it happened;
2. work out whether it touches their code;
3. find every line that does;
4. change those lines;
5. prove the app still works.

Nobody owns this chore, so it waits until something breaks. On 2026-04-22 OpenAI announced that `gpt-3.5-turbo`, `gpt-4` and `o3-mini` would shut down on 2026-10-23. That day, seven of [inspect_ai's live tests failed](https://github.com/meridianlabs-ai/inspect_ai/issues/601) with `404 model_not_found`. The next morning, the commit tool gitted [failed on every call](https://github.com/yegor256/gitted/issues/176), because its default model was still `gpt-3.5-turbo`. The notice existed; nothing connected it to the code.

Today's tools stop short. Dependabot and Renovate open a pull request that bumps the version, and fixing whatever the new version breaks is left to you. A retired model is not a new version, so they open nothing at all. Coding agents can make the edits, but only after a person notices the change, starts them, and checks what they did.

## The idea

Teire does the whole chore, for packages, APIs and AI models alike:
1. It reads only what a repository uses: registries for each locked package, and the change pages of each API the code calls.
2. It finds the exact lines a change reaches, resolved by type where the language allows.
3. It fixes them: the swap the source names first, then a coding agent (GLM 5.3 on Otari) for the rest, after a researcher has read the change.
4. It runs your own typecheck and tests in a sandbox, before and after, with the network off.
5. It opens a pull request that carries the quotes, the call sites, the verification table and every model call's cost as Otari charged it.

Your job becomes reviewing a pull request. When Teire can't prove the fix, it says so: a draft with the reason, or an issue for a person.

### One change, end to end

OpenAI shut down `gpt-3.5-turbo` and `gpt-4` on 2026-10-23. [teire-demo-bristow](https://github.com/Blockchain-Oracle/teire-demo-bristow), a Ruby agent framework, still used them 29 times.

<p align="center">
  <a href="https://teire.84.46.247.92.sslip.io/runs/c154b1d4-ed40-4860-912d-5c587916c2e2">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset=".github/assets/model-retirement-dark.png" />
      <source media="(prefers-color-scheme: light)" srcset=".github/assets/model-retirement-light.png" />
      <img src=".github/assets/model-retirement-light.png" width="960" alt="Sequence: Teire reads OpenAI's deprecations page with verbatim quotes, finds 29 uses in teire-demo-bristow, makes 31 deterministic swaps, sees one spec fail after the swaps, sends GLM 5.3 on Otari to fix it in 6 steps for $0.046 billed to the installation's allowance, verifies 143/143 tests with every network request refused, has DeepSeek V4 Pro review the diff, and opens ready pull request 8 for $0.053." />
    </picture>
  </a>
</p>
<p align="center"><a href="https://teire.84.46.247.92.sslip.io/runs/c154b1d4-ed40-4860-912d-5c587916c2e2">Open the run</a> · <a href=".github/diagrams/readme-model-retirement.mmd">Edit the Mermaid source</a></p>

1. **Notice.** Teire read OpenAI's [deprecations page](https://developers.openai.com/api/docs/deprecations.md) into records, each kept only if its quote appears word for word on the page.
2. **Impact.** 26 uses of `gpt-3.5-turbo`, 2 of `gpt-4` and 1 of `gpt-3.5-turbo-0613`, each linked to its line at the commit Teire read.
3. **Fix.** 31 deterministic swaps to the replacements OpenAI names (`gpt-5.6-terra`, `gpt-5.6-sol`). One spec still failed: a test class declared the old model. **GLM 5.3** found and fixed it in 6 steps for $0.046. **DeepSeek V4 Pro** reviewed the passing diff ($0.0074): no problems.
4. **Verify.** In Cloudflare Containers, with every network request refused: 143/143 tests before, 143/143 after.
5. **Pull request.** [teire-demo-bristow#8](https://github.com/Blockchain-Oracle/teire-demo-bristow/pull/8), ready, opening with **Verified.** Model total **$0.053**, billed by Otari to that installation's allowance. The [run page](https://teire.84.46.247.92.sslip.io/runs/c154b1d4-ed40-4860-912d-5c587916c2e2) shows every step.

### Who pays, on Otari

Teire never counts money itself. Every call names who it is for, as an end user of Teire's Otari service key:

| Work | Billed to | Allowance on Otari |
|---|---|---|
| Ask Teire, public scans, dry runs | the signed-in person, `gh:<GitHub id>` | $0.50 a day |
| Scans, fix runs, CI repair on an installed repository | the installation, `inst:<id>` | $3.00 a day |
| Reading a provider's pages, shared by everyone | `teire:catalog` | $1.00 a day |
| Everything together | Teire's key | the ceiling |

Before work starts, Teire reads the payer's allowance from Otari and starts only if what is left covers what the work may hold at once. A person who runs out reads _"Your AI allowance has $0.020 of $0.02 left, less than this needs to start ($0.025); it comes back at 00:00 UTC"_, and nobody else's work stops. A fix run waits _for this installation's AI allowance_ and starts again by itself after the reset. The operator can move anyone to another budget, or pause them, from Settings › Allowances. ([Allowances](https://teire.84.46.247.92.sslip.io/docs/otari/allowances))

## Demo

<p align="center">
  <a href="https://teire.84.46.247.92.sslip.io/runs/c154b1d4-ed40-4860-912d-5c587916c2e2">
    <img src=".github/assets/demo-cover.png" width="960" alt="Teire on Otari: the run that replaced three retired OpenAI models in teire-demo-bristow, 143 of 143 tests before and after." />
  </a>
</p>
<p align="center"><a href="https://teire.84.46.247.92.sslip.io/runs/c154b1d4-ed40-4860-912d-5c587916c2e2"><b>Open the live run</b></a></p>

Follow the proof yourself on [the live app](https://teire.84.46.247.92.sslip.io):
1. **A real fix.** Open [teire-demo-bristow#8](https://github.com/Blockchain-Oracle/teire-demo-bristow/pull/8): the retired models, the lines, the fix, 143/143 tests before and after, and the receipt naming GLM 5.3 and DeepSeek V4 Pro.
2. **The run.** Its [run page](https://teire.84.46.247.92.sslip.io/runs/c154b1d4-ed40-4860-912d-5c587916c2e2) shows which model answered each step, on which host.
3. **Allowances.** Sign in, open **Settings › Allowances**: your own allowance and your installation's, live from Otari.
4. **A guardrail refusal.** [teire-demo-examples](https://github.com/Blockchain-Oracle/teire-demo-examples) names an extra changelog for zod in its `teire.yml`; it ends with [a planted instruction to the AI](https://github.com/Blockchain-Oracle/teire-demo-examples/blob/main/npm-zod/VENDOR-NOTES.md). On [the zod run](https://teire.84.46.247.92.sslip.io/runs/d522ac54-682c-4571-9c7d-4222ebee5b0e) Otari's guardrail refused it ("refused 1 document(s): Changelog 4.0.0", in the run's Context), Teire read zod's 55 other sources without it, and [PR #25](https://github.com/Blockchain-Oracle/teire-demo-examples/pull/25) upgraded zod 3 → 4 with the tests going from 1/4 to 4/4.
5. **Live.** [/trust](https://teire.84.46.247.92.sslip.io/trust) reads the worker's heartbeat, the models answering, the spend, and what is left of the ceiling on Otari.

## How it works

<p align="center">
  <a href="https://teire.84.46.247.92.sslip.io/docs/build">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset=".github/assets/system-dark.png" />
      <source media="(prefers-color-scheme: light)" srcset=".github/assets/system-light.png" />
      <img src=".github/assets/system-light.png" width="960" alt="System: developers install the GitHub App and use the web app; GitHub webhooks reach the web app, which writes to a Postgres outbox; the worker claims them, reads registries and provider pages, sends every model call, search, fetch and code run to Otari, verifies in Cloudflare Containers, and writes branches, PRs, check runs and issues back to GitHub." />
    </picture>
  </a>
</p>
<p align="center"><a href="https://teire.84.46.247.92.sslip.io/docs/build">Open the architecture</a> · <a href=".github/diagrams/readme-system.mmd">Edit the Mermaid source</a></p>

**Notice.** Every active repository is rescanned daily (or weekly, or never, as `teire.yml` says) and on each push that changes its dependency files or code. A provider's pages are read only when a scanned repository calls it, at most once every 6 hours, shared by every repository. For a provider Teire has no reader for, it finds the deprecation pages with Otari's web search and reads them with Otari's web fetch. Advisories come from OSV and GitHub's advisory database. ([Providers](https://teire.84.46.247.92.sslip.io/docs/ecosystems/providers))

**Impact.** For a major upgrade, Teire diffs the public API of your version against the target with each ecosystem's own tool, then finds the lines that use what changed:

| Ecosystem      | API diff                           | Finds your lines with                              |
| -------------- | ---------------------------------- | -------------------------------------------------- |
| npm            | TypeScript declarations (TS 6.0.3) | the TypeScript type checker                        |
| PyPI           | griffe 2.4.1                       | jedi                                               |
| Go             | apidiff                            | go/types                                           |
| Cargo          | cargo-semver-checks 0.51.0         | a syntax-level search                              |
| RubyGems       | Prism                              | Prism, syntax level                                |
| Maven · Gradle | japicmp 0.26.3                     | imports, then your compiled classes during the fix |

Model IDs and API URLs are found with ast-grep in JS/TS, Python, Go, Rust, Ruby, Java and Kotlin. ([How Teire works](https://teire.84.46.247.92.sslip.io/docs/guide/how-it-works))

**Fix.** Teire writes the manifest and lockfile change, then the deterministic edits: a model swap, or for npm packages a rename a quoted migration note names. If your checks then pass, no agent starts. Otherwise the **researcher** (MiniMax M3) reads the change first, in Otari's tool loop: web search, web fetch and the target's docs through the Context7 MCP server, and for a Python package it installs both versions in **Otari's code sandbox** and prints the signatures your code calls. Its brief passes the guardrail, then the **fixer** (GLM 5.3) works with eight tools (`read_file`, `search`, `edit_file`, `run_check`, `lookup_docs`, `request_upgrade`, `update_plan`, `finish`), edits only the files the change reaches, never manifests, lockfiles, config or CI, with up to 24 steps per attempt and 4 attempts. The **reviewer** (DeepSeek V4 Pro) reads each passing diff for weakened tests or widened validators. Every step of a run carries one `Otari-Conversation-Id`, so it stays on one host and reuses the prompt cache.

<p align="center">
  <a href="https://teire.84.46.247.92.sslip.io/docs/guide/how-it-works">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset=".github/assets/fix-loop-dark.png" />
      <source media="(prefers-color-scheme: light)" srcset=".github/assets/fix-loop-light.png" />
      <img src=".github/assets/fix-loop-light.png" width="960" alt="Fix loop: upgrade transaction, deterministic edits, your checks before vs after; a pass goes to the pull request; a failure first goes to the researcher on Otari, whose brief passes the guardrail, then to the GLM 5.3 fixer, which retries until checks pass or attempts run out; a passing fix goes through the DeepSeek V4 Pro review." />
    </picture>
  </a>
</p>
<p align="center"><a href="https://teire.84.46.247.92.sslip.io/docs/guide/how-it-works">Open the fix loop</a> · <a href=".github/diagrams/readme-fix-loop.mmd">Edit the Mermaid source</a></p>

**Verify.** Two sandboxes start from the same commit, the baseline and the change, in Cloudflare Containers. Each installs with only registries reachable, then runs your checks with the network off. Rules decide the evidence, never a model. ([Verification](https://teire.84.46.247.92.sslip.io/docs/build/verification))

| Evidence                                                                                                     | Opens                             |
| ------------------------------------------------------------------------------------------------------------ | --------------------------------- |
| `verified`                                                                                                   | a ready PR                        |
| `typecheck_only`, `pre_existing_failure`, `needs_live_access`, `needs_local_service`, `environment_mismatch` | a draft PR naming the reason      |
| `regression`, `unverified`, `timeout`                                                                        | an issue, **Teire needs a human** |

### Built on Otari

| Otari feature | What it does in Teire | Where |
|---|---|---|
| **OpenAI-compatible gateway**, one service key | Every model call, through the AI SDK, with structured outputs; Otari's `usage.cost_usd` is the cost on every receipt, so Teire keeps no price list | [`gateway/client.ts`](packages/engine/src/gateway/client.ts) · [`gateway/receipt.ts`](packages/engine/src/gateway/receipt.ts) |
| **Open-weight models in distinct roles** | fixer GLM 5.3 · reviewer DeepSeek V4 Pro · reader DeepSeek V4.1 Flash · researcher MiniMax M3 · assistant gpt-oss-120b | [`constants.ts`](packages/engine/src/constants.ts) (`ROLE_DEFAULTS`) |
| **Automatic provider selection and fallback** | Each role sends a catalog id; Otari picks the host and falls back across up to five. `Otari-Model`, `Otari-Provider`, `Otari-Fallback` and `Otari-Attempt-Count` go on the receipt. `Otari-Conversation-Id` keeps a run on one host | [`gateway/client.ts`](packages/engine/src/gateway/client.ts) · [`fix/run.ts`](packages/engine/src/fix/run.ts) |
| **Per-user budgets** (service key end users) | Every call is billed to a person, an installation or Teire's catalog reader; work checks the payer's allowance first; the operator moves or pauses end users (`PUT`/`PATCH /end-users`) | [`gateway/allowance.ts`](packages/engine/src/gateway/allowance.ts) · [`gateway/identity.ts`](packages/engine/src/gateway/identity.ts) · [`reliability.ts`](apps/worker/src/reliability.ts) · [`allowances.tsx`](apps/web/app/(app)/app/settings/allowances.tsx) |
| **Budgets and spending limits** | A ceiling on Teire's whole key (`GET /key/budget`), on the trust page and the operator view; `403 budget_exceeded` and `402` become typed refusals with a reset time | [`gateway/errors.ts`](packages/engine/src/gateway/errors.ts) · [`trust/page.tsx`](apps/web/app/(site)/trust/page.tsx) |
| **Web search and web fetch** | The researcher's `otari_web_search` and `otari_web_fetch`; discovery of a new provider's deprecation pages | [`fix/research.ts`](packages/engine/src/fix/research.ts) · [`discover/web.ts`](packages/engine/src/discover/web.ts) |
| **MCP** | The researcher names Context7 in `mcp_servers`; Ask Teire's docs mode hands Otari Teire's own MCP server and Context7 | [`fix/research.ts`](packages/engine/src/fix/research.ts) · [`api/mcp/route.ts`](apps/web/app/api/mcp/route.ts) · [`api/assistant/route.ts`](apps/web/app/api/assistant/route.ts) |
| **Code execution** | Installs both versions of a Python package in Otari's sandbox and prints the signatures the repository calls, as proof in the PR | [`fix/research.ts`](packages/engine/src/fix/research.ts) (`pythonProof`) |
| **Guardrails** | Release notes, vendor pages and the research brief name a `prompt-injection` guardrail in block mode; Otari runs it before any model reads them and refuses a flagged one | [`guard/injection.ts`](packages/engine/src/guard/injection.ts) · [`guard/screen.ts`](packages/engine/src/guard/screen.ts) · [`notes/extract.ts`](packages/engine/src/notes/extract.ts) · [`api/guardrails/validate/route.ts`](apps/web/app/api/guardrails/validate/route.ts) |

Other pieces: **Cloudflare Containers** (the verification sandbox, [`apps/sandbox`](apps/sandbox)), the **GitHub App** ([`github/`](packages/engine/src/github) · [`jobs/`](apps/worker/src/jobs)), and optionally **dependabot-core**'s updater (MIT) under gVisor ([`apps/resolver`](apps/resolver)) to decide dependency files.

## How Teire meets the hackathon

The required build, in the organisers' words: _"Build with Open Source AI on Otari!"_, using _"Otari.ai as your hosted AI gateway"_. Teire's Otari work is on the [`otari`](https://github.com/Blockchain-Oracle/teire/tree/otari) branch; Otari came in at [`344189b`](https://github.com/Blockchain-Oracle/teire/commit/344189b0eedebdc26d223c42e9db15af616d8596).

| Rubric line (verbatim) | How Teire meets it | Check it here |
|---|---|---|
| _"20 points: The project meaningfully uses at least one open-weight model."_ | Every model call goes to an open-weight model through Otari; no closed model is called | [`ROLE_DEFAULTS`](packages/engine/src/constants.ts) · the Receipt of [bristow#8](https://github.com/Blockchain-Oracle/teire-demo-bristow/pull/8) |
| _"10 additional points: The project uses two or more open-weight models for different purposes."_ | Five models, five jobs: GLM 5.3 fixes, DeepSeek V4 Pro reviews, DeepSeek V4.1 Flash reads, MiniMax M3 researches, gpt-oss-120b chats. Picked by measuring six models on Teire's own jobs | [Evaluation](https://teire.84.46.247.92.sslip.io/docs/otari/evaluation) |
| _"Model routing and fallbacks"_ | Catalog ids let Otari choose and fall back across each model's hosts; the receipt shows the host and any fallback; one conversation id per run | [Receipts](https://teire.84.46.247.92.sslip.io/docs/otari/receipts) · [`receipt.ts`](packages/engine/src/gateway/receipt.ts) |
| _"MCP integrations"_ | Context7 in the researcher's loop; Teire's own MCP server (`/api/mcp`) and Context7 in Ask Teire's docs mode | [`/api/mcp`](https://teire.84.46.247.92.sslip.io/api/mcp) · [Research, MCP and guardrails](https://teire.84.46.247.92.sslip.io/docs/otari/research) |
| _"Web search or web fetch"_ | The researcher searches and fetches in Otari's loop; discovery finds new providers' pages with both | [Research](https://teire.84.46.247.92.sslip.io/docs/otari/research) · [`discover/web.ts`](packages/engine/src/discover/web.ts) |
| _"Code execution"_ | Both versions of a Python package installed in Otari's sandbox; their signatures printed in the PR | [`pythonProof`](packages/engine/src/fix/research.ts) |
| _"Budgets and spending limits"_ | A ceiling on Teire's key, read live; typed refusals with reset times | [/trust](https://teire.84.46.247.92.sslip.io/trust) · [Allowances](https://teire.84.46.247.92.sslip.io/docs/otari/allowances) |
| _"Multiple models serving distinct roles"_ | The five roles above, each with its own job, limits and checks | [Teire on Otari](https://teire.84.46.247.92.sslip.io/docs/otari) |
| _"Guardrails"_ | A prompt-injection guardrail in block mode on every page Teire reads; Otari refuses a flagged one before any model sees it | [Research, MCP and guardrails](https://teire.84.46.247.92.sslip.io/docs/otari/research#the-prompt-injection-guardrail) |
| _"Per-user budgets"_ | Each person and installation is an end user of the service key, on its own budget; work checks it first and waits for its own reset | [Allowances](https://teire.84.46.247.92.sslip.io/docs/otari/allowances) |
| _"5 points: The application works and demonstrates a real use case."_ | Real PRs on four demo repositories, opened through Otari | [Proof](#proof) |
| _"5 points: The video clearly explains how Otari was integrated and demonstrates the claimed capabilities."_ | The demo video | [Demo](#demo) |

## Proof

**Pull requests opened through Otari** by the installed App on four public demo repositories:

| Repository | PR | What |
|---|---|---|
| teire-demo-bristow (Ruby) | [#8](https://github.com/Blockchain-Oracle/teire-demo-bristow/pull/8) | Replace 3 retired OpenAI models: 31 swaps plus a GLM 5.3 fix, 143/143 tests |
| teire-demo-bristow | [#7](https://github.com/Blockchain-Oracle/teire-demo-bristow/pull/7) | Replace 2 retired Anthropic models |
| teire-demo-nlsh (Go) | [#2](https://github.com/Blockchain-Oracle/teire-demo-nlsh/pull/2) | `golang.org/x/net` v0.38.0 → v0.62.0, fixing 17 advisories |
| teire-demo-nlsh | [#4](https://github.com/Blockchain-Oracle/teire-demo-nlsh/pull/4) | `google.golang.org/grpc` v1.66.2 → v1.83.1, fixing 5 advisories |
| teire-demo-serve-handler (npm) | [#15](https://github.com/Blockchain-Oracle/teire-demo-serve-handler/pull/15) | `form-data` 2.3.3 → 2.5.6, fixing 2 advisories |
| teire-demo-examples (monorepo) | [#5](https://github.com/Blockchain-Oracle/teire-demo-examples/pull/5) | `actionpack` 8.1.4 → 8.1.4.1, fixing 7 advisories |

**The models, measured.** Six open-weight models ran Teire's real fix job and extraction job three times each through Otari; every host offering was probed with a structured-output request. GLM 5.3 and DeepSeek V4 Pro pass the fix job 3 of 3; DeepSeek V4.1 Flash is the only model that quoted every release-note row word for word. ([Evaluation](https://teire.84.46.247.92.sslip.io/docs/otari/evaluation))

**Live.** [/trust](https://teire.84.46.247.92.sslip.io/trust) reads the worker's heartbeat, the models answering, the spend and the ceiling left on Otari, from the running system.

## The rest of Teire

| Surface | What it does | Guide |
|---|---|---|
| Onboarding PR | **Configure Teire** lists what Teire found and the PRs it will open; merging it turns Teire on | [Quickstart](https://teire.84.46.247.92.sslip.io/docs/guide/quickstart) |
| Dashboard issue | One issue per repository: deadlines, what's affected, open PRs; tick a box to fix, rebase or rescan | [Dashboard](https://teire.84.46.247.92.sslip.io/docs/guide/dashboard) |
| `@teire` commands | `rescan`, `fix`, `ignore`, `rebase`, `recreate`, `explain`, `config`, `pause`, `resume`, `wrong`, `help` | [Commands](https://teire.84.46.247.92.sslip.io/docs/guide/commands) |
| Web dashboard | Your estate as one map (changes → repositories → what is open), every PR and run as a breadcrumb trail, config as a board | [Dashboard](https://teire.84.46.247.92.sslip.io/docs/guide/dashboard) |
| Ask Teire | Questions about your repositories, findings, runs and changes, answered by gpt-oss-120b on Otari with the dashboard's own flows; it changes something only when you click Confirm, and spends from your own allowance | [Ask Teire](https://teire.84.46.247.92.sslip.io/docs/guide/ask-teire) |
| Public change catalog | Every confirmed change Teire has read, quoted from its source, with a JSON API and the same tools over MCP | [Providers](https://teire.84.46.247.92.sslip.io/docs/ecosystems/providers) |
| `teire.yml` | What to upgrade, PR limits, custom checks, your own API's changelog or OpenAPI spec | [Configuration](https://teire.84.46.247.92.sslip.io/docs/guide/configuration) |
| CLI and MCP | `teire scan` in any checkout or on any public repository, `teire check` for CI, and `teire mcp` over stdio ([`packages/cli`](packages/cli)) | [CLI](https://teire.84.46.247.92.sslip.io/docs/build/cli) · [MCP](https://teire.84.46.247.92.sslip.io/docs/build/mcp) |
| Runtimes | End-of-life notices for Node.js, Python, Go, Ruby, Java and Rust | [Runtimes](https://teire.84.46.247.92.sslip.io/docs/ecosystems/runtimes) |

## Run it locally

You need Node.js 22+, pnpm 11, Docker for Postgres, an [Otari](https://otari.ai) service key with the budgets in [`docs/otari-setup.md`](docs/otari-setup.md), a Cloudflare account with Containers for the sandbox, and a GitHub organisation for the App.

```bash
pnpm install
cp .env.example .env.local
ln -s ../../.env.local apps/web/.env.local

# Postgres 17; the worker applies migrations when it starts
docker run -d --name teire-pg -e POSTGRES_PASSWORD=teire -e POSTGRES_DB=teire -p 5432:5432 postgres:17
# .env.local: DATABASE_URL=postgres://postgres:teire@127.0.0.1:5432/teire
# .env.local: OTARI_SERVICE_KEY=<your service key> (an ordinary OTARI_API_KEY works too: calls then bill the key)

# A GitHub App for your organisation; its credentials and a smee.io webhook URL go into .env.local
TEIRE_GITHUB_ORG=your-org node scripts/register-github-app.mjs

# The verification sandbox on Cloudflare Containers
cd apps/sandbox && npx wrangler deploy && npx wrangler secret put TEIRE_SANDBOX_KEY && cd ../..
# .env.local: TEIRE_SANDBOX_URL=<the Worker URL>, TEIRE_SANDBOX_KEY=<the same key>

pnpm --parallel --filter ./apps/web --filter ./apps/worker dev   # web on :3000, worker on :8080
npx smee-client --url <SMEE_URL from .env.local> --target http://localhost:3000/api/github/webhooks
```

Then install your App on a repository from its GitHub page. Every variable is described in [`.env.example`](.env.example); the Otari dashboard setup (budgets, the service key, the ceiling, tools) is in [`docs/otari-setup.md`](docs/otari-setup.md).

```bash
pnpm typecheck && pnpm lint && pnpm test   # engine, worker and web
```

## Repository layout

| Path                                   | What lives here                                                                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| [`apps/web`](apps/web)                 | The Next.js app: landing, public scan and dry runs, run pages, the change catalog, dashboard, allowances, trust, docs, the MCP server, the guardrails service and the GitHub webhook endpoint |
| [`apps/worker`](apps/worker)           | Webhooks from the outbox, scans, fix runs, `@teire` commands, the Dashboard issue, the reliability ticker                                  |
| [`apps/sandbox`](apps/sandbox)         | The Cloudflare Containers sandbox: six images (Node, Python, Go, Rust, Ruby, JVM) and its egress policy                                    |
| [`packages/engine`](packages/engine)   | Everything that reads, diffs, locates, fixes and verifies, and the Otari gateway (`src/gateway`); the worker, the CLI and the web all call it |
| [`packages/db`](packages/db)           | Postgres schema and migrations                                                                                                             |
| [`packages/cli`](packages/cli)         | `teire scan`, `teire check`, `teire mcp`                                                                                                   |
| [`packages/helpers`](packages/helpers) | The Python and Go helpers the engine runs for griffe, jedi, apidiff and go/types                                                           |
| [`docs`](docs)                         | The Otari dashboard setup and the feedback on Otari written while building                                                                 |
| [`fixtures`](fixtures)                 | Small repositories and pages the engine's tests run against                                                                                |

## Credits

- [Otari](https://github.com/mozilla-ai/otari) by Mozilla.ai, the gateway every model call, search, fetch and code run goes through.
- Registry data from [deps.dev](https://deps.dev), advisories from [OSV](https://osv.dev), the [GitHub Advisory Database](https://github.com/advisories) and [ruby-advisory-db](https://github.com/rubysec/ruby-advisory-db), runtime dates from [endoflife.date](https://endoflife.date), library docs from [Context7](https://context7.com).
- Provider changes are quoted from each provider's own pages.
- Code adapted from other open-source projects is credited, with its licence, in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
- Teire was first built for an earlier hackathon on another AI stack; this branch moves every model call, search and fetch to Otari and adds what Otari makes possible (allowances, the researcher, the guardrail, the MCP server).

## Honest limits

- **Routing policies aren't in use yet.** Each role sends a catalog id and Otari's automatic provider selection falls back between hosts; the six policies drafted in [`docs/otari-setup.md`](docs/otari-setup.md) (tier-down to a cheaper model at 80 % of a budget, a second model family on failure) are saved in another workspace than Teire's key, so they don't resolve.
- **MCP needs one workspace switch.** Otari refuses a request that names an MCP server by URL until "Let requests name their own MCP servers" is on; until then the researcher works from web search and fetch, and docs mode from its own tools.
- **The guardrail is Teire's own service.** otari.ai serves no request-level guardrail profile, so Teire's prompt-injection check is a pattern detector Teire hosts, named on each request and run by Otari.
- **Code proof is for Python packages only,** and a version with no wheel for Python 3.13 is said so rather than compared.
- **Only major upgrades** get an API diff and a line search; minor and patch upgrades are plain bumps the sandbox decides.
- **Ruby at scan time is matched by name,** so a site that only shares a removed method's name reads "inconclusive", and the sandbox run decides.
- **Dependency files** on this deployment are written by Teire's own manifest and lockfile edits; dependabot-core's updater is optional ([`apps/resolver`](apps/resolver)).

The full list, per ecosystem, is in the [docs](https://teire.84.46.247.92.sslip.io/docs/ecosystems).

## License

[MIT](LICENSE)
