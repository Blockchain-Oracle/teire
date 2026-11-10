#!/usr/bin/env node
/**
 * Otari's REST types for the gateway client (packages/engine/src/gateway/rest.ts). Reads Otari's
 * public OpenAPI spec, keeps only the endpoints Teire calls and the schemas they reference, pins the
 * result in the repo, and generates `otari.d.ts` from it with openapi-typescript.
 *
 *   node scripts/otari-openapi.mjs                    # fetch the live spec
 *   node scripts/otari-openapi.mjs path/to/spec.json  # or read a saved copy
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SPEC_URL = "https://api.otari.ai/api/v1/openapi.json";
const OUT_DIR = fileURLToPath(new URL("../packages/engine/src/gateway/", import.meta.url));

/** The endpoints Teire calls, and nothing else (the full spec is over 1 MB). */
const PATHS = [
  "/api/v1/search",
  "/api/v1/fetch",
  "/api/v1/code/execute",
  "/api/v1/tools",
  "/api/v1/key/budget",
  "/api/v1/end-users",
  "/api/v1/end-user-budgets",
  "/api/v1/usage/requests/{request_id}",
];

const source = process.argv[2];
const spec = source
  ? JSON.parse(readFileSync(source, "utf8"))
  : await fetch(SPEC_URL).then((r) => {
      if (!r.ok) throw new Error(`${SPEC_URL} answered ${r.status}`);
      return r.json();
    });

const missing = PATHS.filter((p) => !spec.paths?.[p]);
if (missing.length) throw new Error(`Otari's spec no longer has: ${missing.join(", ")}`);

// Every schema the kept paths reach, followed through $refs until nothing new turns up.
const keep = new Set();
const visit = (node) => {
  if (Array.isArray(node)) return node.forEach(visit);
  if (!node || typeof node !== "object") return;
  for (const [k, v] of Object.entries(node)) {
    if (k === "$ref" && typeof v === "string" && v.startsWith("#/components/schemas/")) {
      const name = v.slice("#/components/schemas/".length);
      if (!keep.has(name)) {
        keep.add(name);
        visit(spec.components.schemas[name]);
      }
    } else visit(v);
  }
};
const paths = Object.fromEntries(PATHS.map((p) => [p, spec.paths[p]]));
visit(paths);

const pruned = {
  openapi: spec.openapi,
  info: { ...spec.info, description: `Pruned by scripts/otari-openapi.mjs from ${SPEC_URL}` },
  paths,
  components: {
    schemas: Object.fromEntries([...keep].sort().map((n) => [n, spec.components.schemas[n]])),
    ...(spec.components.securitySchemes ? { securitySchemes: spec.components.securitySchemes } : {}),
  },
};
const jsonPath = `${OUT_DIR}otari.openapi.json`;
writeFileSync(jsonPath, `${JSON.stringify(pruned, null, 2)}\n`);
// Fields with a default (`include_raw`) stay optional in requests, as the API treats them.
execFileSync(
  "pnpm",
  ["exec", "openapi-typescript", jsonPath, "-o", `${OUT_DIR}otari.d.ts`, "--default-non-nullable", "false"],
  {
    stdio: "inherit",
  },
);
console.log(`otari ${spec.info?.version}: ${PATHS.length} paths, ${keep.size} schemas`);
