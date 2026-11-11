# Diagrams

Mermaid sources for the README and the docs, rendered in Teire's own colours (`mermaid-light.json`, `mermaid-dark.json`) at 2x:

```bash
~/.claude/skills/project-docs/scripts/render_diagrams.sh .github/diagrams .github/assets '#f5f5ef' '#0d0f13'
```

| Source                        | Shows                                                                            |
| ----------------------------- | -------------------------------------------------------------------------------- |
| `readme-system.mmd`           | The system: GitHub, the web app, Postgres, the worker, and every outside service |
| `readme-model-retirement.mmd` | teire-demo-bristow#8: a model retirement from notice to verified PR, on Otari    |
| `readme-fix-loop.mmd`         | How a fix run decides: transaction, deterministic edits, the agent, the evidence |
