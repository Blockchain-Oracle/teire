-- Every model call goes through Otari (plan S01): each one keeps what Otari reported about it. Who it
-- was billed to (an end user of the service key: gh:<id>, inst:<id>, teire:catalog), Otari's request
-- id (joins its usage rows), the model and provider that actually answered, whether a fallback served
-- it, the guardrail verdicts and the tools Otari ran itself. Calls with no run (scans, triage, provider
-- pages) now name their repository and installation, so Usage shows them too.
-- The web role's grants on both tables are table-wide (0009, 0020), so the new columns are covered.
ALTER TABLE "llm_calls" ADD COLUMN IF NOT EXISTS "installation_id" bigint;
ALTER TABLE "llm_calls" ADD COLUMN IF NOT EXISTS "repo_id" bigint;
ALTER TABLE "llm_calls" ADD COLUMN IF NOT EXISTS "end_user" text;
ALTER TABLE "llm_calls" ADD COLUMN IF NOT EXISTS "request_id" text;
ALTER TABLE "llm_calls" ADD COLUMN IF NOT EXISTS "served_model" text;
ALTER TABLE "llm_calls" ADD COLUMN IF NOT EXISTS "provider" text;
ALTER TABLE "llm_calls" ADD COLUMN IF NOT EXISTS "fallback" boolean NOT NULL DEFAULT false;
ALTER TABLE "llm_calls" ADD COLUMN IF NOT EXISTS "attempts" integer;
ALTER TABLE "llm_calls" ADD COLUMN IF NOT EXISTS "pricing_source" text;
ALTER TABLE "llm_calls" ADD COLUMN IF NOT EXISTS "tool_calls" jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "llm_calls" ADD COLUMN IF NOT EXISTS "guardrails" jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "llm_calls" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'done';
CREATE INDEX IF NOT EXISTS "llm_calls_installation_idx" ON "llm_calls" ("installation_id", "created_at");
CREATE INDEX IF NOT EXISTS "llm_calls_repo_idx" ON "llm_calls" ("repo_id", "created_at");
CREATE INDEX IF NOT EXISTS "llm_calls_request_idx" ON "llm_calls" ("request_id");

ALTER TABLE "assistant_calls" ADD COLUMN IF NOT EXISTS "end_user" text;
ALTER TABLE "assistant_calls" ADD COLUMN IF NOT EXISTS "request_id" text;
ALTER TABLE "assistant_calls" ADD COLUMN IF NOT EXISTS "served_model" text;
ALTER TABLE "assistant_calls" ADD COLUMN IF NOT EXISTS "provider" text;
ALTER TABLE "assistant_calls" ADD COLUMN IF NOT EXISTS "fallback" boolean NOT NULL DEFAULT false;
ALTER TABLE "assistant_calls" ADD COLUMN IF NOT EXISTS "tool_calls" jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "assistant_calls" ADD COLUMN IF NOT EXISTS "guardrails" jsonb NOT NULL DEFAULT '[]'::jsonb;
