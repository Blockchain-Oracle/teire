# Otari setup for this instance

Otari's admin routes (budgets, spend ceilings, keys, routing policies, guardrails) accept only a
dashboard session or a deployment's master key, so this setup is done once by hand in the
[otari.ai dashboard](https://otari.ai). Everything the app does afterwards uses the keys created
here. `pnpm otari:verify` (S01) reads the result back with the service key and lists anything
missing.

Region: US (`https://api.otari.ai/api/v1`). All amounts are USD.

## 1. Organization and credit

1. Sign up at otari.ai and create an organization (any name, e.g. `Teire`).
2. Add credit to the organization balance. Requests served with otari.ai's own provider keys are
   paid from it.

## 2. Budgets (Organization → Spend & Budgets → Add budget)

| Name                       | Amount | Period | What it caps                                            |
| -------------------------- | ------ | ------ | ------------------------------------------------------- |
| `teire-person-daily`       | 0.50   | Daily  | one person: Ask Teire, public-scan reading, dry runs    |
| `teire-installation-daily` | 3.00   | Daily  | one installation: scans, fix runs, CI repair, re-verify |
| `teire-operator-daily`     | 2.00   | Daily  | the operator walk                                       |
| `teire-catalog-daily`      | 1.00   | Daily  | shared catalog reading (provider pages)                 |
| `teire-walk-tiny`          | 0.02   | Daily  | the demo walk: a person who runs out                    |
| `teire-walk-raised`        | 1.00   | Daily  | the demo walk: the same person after a raise            |
| `teire-service-daily`      | 10.00  | Daily  | everything together (used by the ceiling in step 4)     |

The amounts are first values; S02 measures cost per fix run and per reply and they are adjusted here.

## 3. Keys (API keys → Create key)

**Service key** (Advanced → service key). The service flag and the budget list cannot be changed
after the key is created.
- Name: `teire-service`
- Service key: on
- Default end-user budget (`end_user_budget_id`): `teire-person-daily`
- End-user budgets a request may choose (`end_user_budget_ids`): `teire-person-daily`,
  `teire-installation-daily`, `teire-operator-daily`, `teire-catalog-daily`, `teire-walk-tiny`,
  `teire-walk-raised`
- Max end users: leave the default (10,000)

**CLI key** (an ordinary key, not a service key)
- Name: `teire-cli`

The first key made (2026-11-10) is an ordinary key: it is saved as `OTARI_API_KEY` and runs
everything today, billed to the key. Per-person and per-installation allowances start working the
moment a service key is saved as `OTARI_SERVICE_KEY` (the gateway checks the key type itself).

Give both keys to Claude through the secrets file, never in chat:
`/Users/abu/dev/hackathon/otari/.secrets/teire-otari.env`, lines `OTARI_SERVICE_KEY=…` and
`OTARI_CLI_KEY=…`.

## 4. Spend ceiling (Spend & Budgets → Add ceiling)

- Capping: the API key `teire-service`
- Budget: `teire-service-daily`
- Name: `teire-service-ceiling`

## 5. Tools (Workspace → Tools)

Checked on 2026-11-10 with `GET /api/v1/tools`: code execution is available; **web search and web
fetch answer `workspace_disabled`**. Turn both on:

- Web search: Allowed.
- Web fetch: Allowed.
- Code execution: Follow the deployment default (or Allowed).
- MCP servers: nothing to add. Teire passes Context7 and its own MCP server inline per request.

## 6. Routing policies (Workspace → Routing → Policies)

Filled in during S02 from measured runs: five policies (`teire-fixer`, `teire-reviewer`,
`teire-reader`, `teire-researcher`, `teire-assistant`), each a fallback chain of concrete
provider offerings, at most five entries, with tier-down at 80 % of the end user's budget.

## 7. Guardrails (Organization → Guardrails)

Nothing yet. S01 checks which guardrail profiles otari.ai serves. If `prompt-injection` is not
among them, one guardrail is configured here from the catalog.
