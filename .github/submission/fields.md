# Submission: Teire on Otari

For the **Mozilla Otari Hackathon – Devs Wilding Online** (track **Build on Otari!**). The organisers
ask for the same seven items by email (a reply to the sign-up thread with marcus+wilding@mozilla.org)
and on DoraHacks ("Submit Build"). Every item below is ready to paste, in the organisers' order. The
long story is [story.md](story.md), the written feedback [feedback.md](feedback.md), the issue drafts
for the Otari repository [otari-issues.md](otari-issues.md), and the demo script
[video-script.md](video-script.md).

## 1. Project name, Otari sign-up email, one line

- **Project name:** Teire · 手入れ
- **Email you signed up to Otari.ai with:** `<your Otari sign-up email>` (not written into this public file)
- **One line (145 characters):** Teire finds the code a package, API or AI-model change breaks, fixes it with open-weight models on Otari, and proves the fix with your own tests.

## 2. Public GitHub repository and hackathon branch

- https://github.com/Blockchain-Oracle/teire
- Branch: **`otari`** (https://github.com/Blockchain-Oracle/teire/tree/otari)

## 3. The first commit where Otari came in

https://github.com/Blockchain-Oracle/teire/commit/344189b0eedebdc26d223c42e9db15af616d8596
("Otari comes in: every model call, search and fetch goes through Otari")

## 4. Otari features used

Every one is used by the running application, not only enabled in the dashboard:

| Rubric feature | How Teire uses it | Proof |
|---|---|---|
| Open-weight models (×5, different purposes) | GLM 5.3 fixes code, DeepSeek V4 Pro reviews, DeepSeek V4.1 Flash reads release notes and provider pages, MiniMax M3 researches, gpt-oss-120b answers Ask Teire | Receipt of https://github.com/Blockchain-Oracle/teire-demo-bristow/pull/8 · https://teire.84.46.247.92.sslip.io/docs/otari/evaluation |
| Multiple models serving distinct roles | Five roles, each with its own job, limits and checks | `packages/engine/src/constants.ts` (`ROLE_DEFAULTS`) |
| Per-user budgets | Every call is billed to an end user of Teire's service key: each signed-in person (`gh:<id>`, $0.50/day), each GitHub App installation (`inst:<id>`, $3/day), Teire's shared catalog reader. Work reads the payer's allowance first and waits for its own reset; the operator moves or pauses end users (`PUT`/`PATCH /end-users`) | Settings › Allowances · https://teire.84.46.247.92.sslip.io/docs/otari/allowances |
| Budgets and spending limits | A ceiling on Teire's key, read live (`GET /key/budget`) on the trust page and the operator view; `403 budget_exceeded` and `402` become typed refusals with a reset time | https://teire.84.46.247.92.sslip.io/trust |
| Model routing and fallbacks | Each role sends a catalog id, so Otari chooses the host and falls back across up to five; the receipt keeps `Otari-Provider`, `Otari-Fallback`, `Otari-Attempt-Count`; one `Otari-Conversation-Id` per fix run and per Ask Teire thread keeps it on one host for the prompt cache | https://teire.84.46.247.92.sslip.io/docs/otari/receipts |
| Web search and web fetch | The researcher's `otari_web_search` and `otari_web_fetch` before every fix that needs the fixer; discovery of a new provider's deprecation pages | https://teire.84.46.247.92.sslip.io/docs/otari/research |
| MCP | The researcher names Context7 in `mcp_servers`; Ask Teire's docs mode hands Otari Teire's own MCP server (`/api/mcp`) and Context7. Otari runs request-named MCP servers only once the workspace allows them; until then the researcher falls back to web search and fetch | https://teire.84.46.247.92.sslip.io/api/mcp |
| Code execution | For a Python upgrade, both versions are installed in Otari's code sandbox and the signatures the repository calls are printed in the PR | `packages/engine/src/fix/research.ts` (`pythonProof`) |
| Guardrails | Release notes, vendor pages and the research brief name a `prompt-injection` guardrail in block mode; Otari runs it before any model reads them and refuses a flagged one. On the zod run Otari refused a planted changelog and Teire read the other 55 sources without it (PR #25) | https://teire.84.46.247.92.sslip.io/runs/d522ac54-682c-4571-9c7d-4222ebee5b0e?tile=change · https://github.com/Blockchain-Oracle/teire-demo-examples/blob/main/npm-zod/VENDOR-NOTES.md (planted) · https://github.com/Blockchain-Oracle/teire-demo-examples/pull/25 |

## 5. PRs or issues opened on the Otari repository

Drafted in [otari-issues.md](otari-issues.md) from the friction met while building; filed by the
owner (fill in the links once filed).

## 6. Demo video (3–5 minutes)

`<YouTube link>`: a screen recording with the owner's own voice, following [video-script.md](video-script.md).

## 7. Feedback

- Written: [feedback.md](feedback.md) answers the three written questions.
- Screen recording (3–5 minutes): `<link>`, answering the four spoken questions; talking points in [feedback.md](feedback.md#for-the-feedback-recording).

## Links

- Live app: https://teire.84.46.247.92.sslip.io
- Teire on Otari (docs): https://teire.84.46.247.92.sslip.io/docs/otari
- A real fix through Otari: https://github.com/Blockchain-Oracle/teire-demo-bristow/pull/8
- Its run: https://teire.84.46.247.92.sslip.io/runs/c154b1d4-ed40-4860-912d-5c587916c2e2
- Live status: https://teire.84.46.247.92.sslip.io/trust
- Feedback log written while building: https://github.com/Blockchain-Oracle/teire/blob/otari/docs/otari-feedback.md
