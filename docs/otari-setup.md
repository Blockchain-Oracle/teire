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

**Service key** (Advanced → service key). The service flag cannot be changed after the key is
created; its default budget and budget list can (edit the key), and apply to end users created from
then on.
- Name: `teire-service`
- Service key: on
- Default end-user budget (`end_user_budget_id`): `teire-person-daily`
- End-user budgets a request may choose (`end_user_budget_ids`): `teire-person-daily`,
  `teire-installation-daily`, `teire-operator-daily`, `teire-catalog-daily`, `teire-walk-tiny`,
  `teire-walk-raised`
- Max end users: leave the default (10,000)

**CLI key** (an ordinary key, not a service key)
- Name: `teire-cli`

The first key made (2026-11-10) is an ordinary key, saved as `OTARI_API_KEY`. The service key
(2026-11-10) is saved as `OTARI_SERVICE_KEY` and is the one the app uses. Teire names an end user only
when the service key holds that end user's budget (Otari puts a new end user on a budget once, at its
first call), so calls are billed to the key until the budgets are on it, and the gateway re-reads the
key's budget list every five minutes: budgets added to the key apply without a redeploy.

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

One policy per role. Each starts on the offering that answered best in S02's measurements
(`scripts/otari-offerings.ts`, `scripts/compare-models.ts`, 2026-11-10), moves to a cheaper model
once the end user has used 80 % of its budget, and falls back to other hosts, then to a second
model. Every entry below answered a structured-output request through Otari on 2026-11-10. A plan
holds at most five candidates.

Teire switches a role to its policy only after each policy answers a test call
(`TEIRE_MODEL_<ROLE>=teire-<role>`). Until then each role uses its catalog id, which Otari already
falls back across up to five hosts of the same model.

| Policy             | When 80 % of the budget is used                  | Default                                          | On failure, in order                                                                                                                |
| ------------------ | ------------------------------------------------ | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `teire-fixer`      | `deepinfra:deepseek-ai/DeepSeek-V4.1-Flash-1017` | `fireworks:accounts/fireworks/models/glm-5p3`    | `together:zai-org/GLM-5.3`, `mistral:zai-glm-5-3`, `deepinfra:deepseek-ai/DeepSeek-V4-Pro-0813`                                     |
| `teire-reviewer`   | `deepinfra:deepseek-ai/DeepSeek-V4.1-Flash-1017` | `deepinfra:deepseek-ai/DeepSeek-V4-Pro-0813`     | `together:deepseek-ai/DeepSeek-V4-Pro-0813`, `nebius:deepseek-ai/DeepSeek-V4-Pro-0813`, `together:zai-org/GLM-5.3`                  |
| `teire-reader`     | `deepinfra:openai/gpt-oss-120b`                  | `deepinfra:deepseek-ai/DeepSeek-V4.1-Flash-1017` | `mistral:deepseek-v4-1-flash-1017`, `fireworks:accounts/fireworks/models/deepseek-v4p1-flash-1017`, `deepinfra:openai/gpt-oss-120b` |
| `teire-researcher` | `deepinfra:deepseek-ai/DeepSeek-V4.1-Flash-1017` | `deepinfra:MiniMaxAI/MiniMax-M3`                 | `fireworks:accounts/fireworks/models/minimax-m3`, `nebius:MiniMaxAI/MiniMax-M3`, `deepinfra:deepseek-ai/DeepSeek-V4.1-Flash-1017`   |
| `teire-assistant`  | (none: already the cheapest)                     | `deepinfra:openai/gpt-oss-120b`                  | `together:openai/gpt-oss-120b`, `nebius:openai/gpt-oss-120b`, `deepinfra:deepseek-ai/DeepSeek-V4.1-Flash-1017`                      |

As configuration (the dashboard's policy editor takes the same fields):

```yaml
teire-fixer:
  select:
    - when: { budget_used_pct: { gte: 80 } }
      target: deepinfra:deepseek-ai/DeepSeek-V4.1-Flash-1017
    - default: fireworks:accounts/fireworks/models/glm-5p3
  on_failure:
    - together:zai-org/GLM-5.3
    - mistral:zai-glm-5-3
    - deepinfra:deepseek-ai/DeepSeek-V4-Pro-0813
```

One more policy, `teire-fallback-check`, proves the fallback path: its default is
`together:MiniMaxAI/MiniMax-M3`, which refuses structured output (400), and its `on_failure` is
`deepinfra:MiniMaxAI/MiniMax-M3`. `scripts/otari-offerings.ts --policies` calls it and expects
`Otari-Fallback: true` with two attempts. No role uses it.

Left out on purpose: `together:MiniMaxAI/MiniMax-M3` refuses structured output (400),
`nebius:MiniMaxAI/MiniMax-M3` took 42 s for a one-line answer, and Kimi K2.6 passed the fix job but
took 55–109 s per run and timed out at the gateway on the extraction job.

## 7. Guardrails (Organization → Guardrails)

Nothing yet. S01 checks which guardrail profiles otari.ai serves. If `prompt-injection` is not
among them, one guardrail is configured here from the catalog.
