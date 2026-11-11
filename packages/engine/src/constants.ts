/** Every tunable number in one place. Values come from the build plan's decisions. */

/**
 * This deployment's own addresses. One setting moves the whole instance to another domain: the PR
 * text, the config schema's `$id`, the bot's User-Agent and the CLI's default catalog all read it.
 */
const PUBLIC_URL = (process.env.TEIRE_PUBLIC_URL ?? "https://teire.84.46.247.92.sslip.io").replace(
  /\/+$/,
  "",
);
export const SITE = {
  url: PUBLIC_URL,
  schemaUrl: `${PUBLIC_URL}/schema.json`,
  configDocsUrl: `${PUBLIC_URL}/docs/config`,
  sourceUrl: "https://github.com/Blockchain-Oracle/teire",
} as const;

/**
 * Otari (mozilla.ai), the gateway every model call goes through: one key, the served model, provider,
 * fallback and real cost on each response, and per-person and per-installation budgets (plan S01).
 */
export const GATEWAY = {
  /** OpenAI-compatible base URL; `/api` is part of it (without it Otari answers 404). */
  baseUrl: "https://api.otari.ai/api/v1",
  /** AI SDK provider name: request options travel as `providerOptions.otari`, metadata comes back under it. */
  providerName: "otari",
  /** Otari's server-side tool loop (web search, fetch, code, MCP): its default rounds, and its cap is 25. */
  maxToolIterations: 10,
  /** How long the service key's end-user budget list is kept: budgets added in the dashboard apply within this. */
  budgetsRefreshMs: 5 * 60_000,
} as const;

/**
 * The model behind each job. A catalog id (`vendor/model`) lets Otari choose among that model's hosts
 * and fall back between them; `TEIRE_MODEL_<ROLE>` replaces it with another id, a `provider:model`
 * selector or a routing-policy name (S02). All open-weight, all with tool calls and structured output
 * in Otari's catalog (read 2026-11-10):
 * fixer      — writes and repairs code in the agent loop (GLM 5.3: fireworks, together, nebius, mistral);
 * reviewer   — checks a fix and a bump's notes (DeepSeek V4 Pro);
 * reader     — extraction and triage, many short calls (DeepSeek V4.1 Flash, the cheapest of the set);
 * researcher — reads the web and docs before a fix (MiniMax M3, S04);
 * assistant  — Ask Teire's chat, chosen for speed and price (gpt-oss-120b on five hosts).
 */
export const ROLE_ENV = {
  fixer: "TEIRE_MODEL_FIXER",
  reviewer: "TEIRE_MODEL_REVIEWER",
  reader: "TEIRE_MODEL_READER",
  researcher: "TEIRE_MODEL_RESEARCHER",
  assistant: "TEIRE_MODEL_ASSISTANT",
} as const;

/** People's names for the open-weight models the roles run on (ids from Otari's catalog or its hosts). */
const MODEL_NAMES: [RegExp, string][] = [
  [/glm-5[.p]3/i, "GLM 5.3"],
  [/kimi-k2[.p]6/i, "Kimi K2.6"],
  [/deepseek-v4[.p]1-flash/i, "DeepSeek V4.1 Flash"],
  [/deepseek-v4-pro/i, "DeepSeek V4 Pro"],
  [/minimax-m3/i, "MiniMax M3"],
  [/gpt-oss-120b/i, "gpt-oss-120b"],
  [/rune-26b/i, "Rune 26B"],
];

/** A model id as people say it ("deepseek/deepseek-v4-pro-0813" → "DeepSeek V4 Pro"); others lose their vendor prefix. */
export function modelDisplayName(id: string) {
  return MODEL_NAMES.find(([re]) => re.test(id))?.[1] ?? id.replace(/^.*\//, "");
}

export const ROLE_DEFAULTS: Record<keyof typeof ROLE_ENV, string> = {
  fixer: "z-ai/glm-5.3",
  reviewer: "deepseek/deepseek-v4-pro-0813",
  reader: "deepseek/deepseek-v4.1-flash-1017",
  researcher: "minimax/minimax-m3",
  assistant: "openai/gpt-oss-120b",
};

/**
 * Who a call is billed to on Otari (an end user of the service key). People and installations each
 * get their own daily allowance; work nobody owns is billed to Teire's two shared end users. The
 * budget names are the dashboard's (docs/otari-setup.md); a new end user starts on its budget.
 */
export const END_USERS = {
  person: { prefix: "gh:", budget: "teire-person-daily" },
  installation: { prefix: "inst:", budget: "teire-installation-daily" },
  operator: { id: "teire:operator", budget: "teire-operator-daily" },
  catalog: { id: "teire:catalog", budget: "teire-catalog-daily" },
} as const;

/**
 * How much must be left in an allowance on Otari before work starts (Otari holds each call's prompt
 * and full output limit until it settles, and refuses a hold that doesn't fit). Measured 2026-11-10
 * (context/02-otari-api-and-integrations/s02-measurements-2026-11-10.md): one GLM 5.3 fixer step
 * holds 16,000 output tokens x $4.40/M = $0.07 plus its prompt, so a fix run starts with two steps'
 * worth; a scan's reader holds far less; an Ask Teire reply is up to 8 small steps (about $0.012).
 */
export const ALLOWANCE = {
  fixRunUsd: 0.15,
  scanUsd: 0.03,
  replyUsd: 0.025,
} as const;

/**
 * The researcher (S04): one call in Otari's tool loop before a fix. Measured 2026-11-11 with MiniMax M3:
 * two searches and a fetch took 26 s and cost $0.045. Context7 is offered over MCP when the workspace
 * lets a request name MCP servers; Otari's code sandbox reaches PyPI (pip install works, 4 s).
 */
export const RESEARCH = {
  searches: 2,
  /** Two searches, two fetches and the answer: an unbounded loop read 8 pages for $0.12 in 125 s. */
  toolIterations: 5,
  maxOutputTokens: 4_000,
  timeoutMs: 150_000,
  /** A 429 is asked once more after Otari's Retry-After, or this when it sends none; never longer than the cap. */
  rateLimitWaitMs: 8_000,
  rateLimitMaxWaitMs: 30_000,
  maxChanges: 8,
  maxSources: 8,
  maxApis: 8,
  context7Url: "https://mcp.context7.com/mcp",
  codeTimeoutMs: 90_000,
  maxProofChars: 4_000,
  /** The reader shaping the prose into a brief, and how much prose it reads. */
  shapeMaxTokens: 3_000,
  maxResearchChars: 12_000,
} as const;

/** Ask Teire's limits (plan revision 3.3, U4, D127): per reply, per person per day, all of it per day. */
/**
 * The overall model budget per day (fix runs and chat together), when TEIRE_DAILY_COST_CAP_USD is unset:
 * one number the worker and the web both read.
 */
export const DAILY_COST_CAP_DEFAULT_USD = 10;

export const ASSISTANT = {
  /** One reply's model time and tool steps. */
  replyMs: 60_000,
  /** Low: chat answers read tool data back and must not wander from it. */
  temperature: 0.3,
  maxSteps: 8,
  maxOutputTokens: 2_000,
  // What a person may spend is their budget on Otari (ALLOWANCE, docs/otari-setup.md), not a number here.
  /** A reservation no reply settled (its function was stopped) counts at its estimate after this. */
  staleReservationMs: 15 * 60_000,
  /** Threads, their messages and their receipts are kept this long. */
  retentionDays: 90,
  /** Tool output handed to the model, per call. */
  maxToolChars: 12_000,
} as const;

/**
 * Each package manager's download cache in the sandbox (HOME=/home/teire during the install), the
 * only thing saved between runs (R21.11): packages as downloaded, never built output or the tree.
 * Bundler has none here: gems install into the Ruby's own directory, so it isn't cached.
 */
export const DOWNLOAD_CACHE: Record<string, string> = {
  npm: "/home/teire/.npm/_cacache",
  pnpm: "/home/teire/.local/share/pnpm/store",
  yarn: "/home/teire/.cache/yarn",
  bun: "/home/teire/.bun/install/cache",
  pip: "/home/teire/.cache/pip",
  pipenv: "/home/teire/.cache/pip",
  uv: "/home/teire/.cache/uv",
  poetry: "/home/teire/.cache/pypoetry",
  go: "/home/teire/go/pkg/mod/cache/download",
  cargo: "/home/teire/.cargo/registry/cache",
  maven: "/home/teire/.m2/repository",
  gradle: "/home/teire/.gradle/caches/modules-2/files-2.1",
};

export const FIX = {
  /**
   * Co-upgrades whose API is diffed and located like the lead's (D-10): the largest version jumps
   * first, the rest listed with why they weren't.
   */
  maxCoMovedDiffed: 8,
  /** Other dependencies the agent may ask dependabot-core's updater to move in one run (S15.2). */
  maxUpgradeRequests: 2,
  /** Asks of the updater in one run, landed or not (each can hold the run up to its own wait). */
  maxUpgradeAttempts: 4,
  /**
   * An agent's request waits for its job inside one attempt: the updater gets ten minutes and the
   * request gives up after fifteen, queue included (a run's own job may take the full 20 and an hour).
   */
  upgradeRequestTimeoutSec: 600,
  upgradeRequestWaitMs: 15 * 60_000,
  /**
   * The resolver host's overlay limits (`teire-resolver.py`): files per job and characters each. The
   * host counts a Python str's code points; JavaScript's UTF-16 length is never fewer, so a file
   * that passes here passes there.
   */
  maxOverlayFiles: 20,
  maxOverlayChars: 1_000_000,
  /** Lines kept after an error line, up to the next blank line (a rustc diagnostic with its `help:`). */
  errorContextLines: 30,
  maxErrorLines: 220,
  /** Failed verifications before the agent discards its plan and starts over from the evidence. */
  replanAfterFailures: 2,
  /** Fix attempts at one target version before falling back one major (plan D71). */
  maxAttemptsPerTarget: 4,
  /** How many majors Teire may step back from the latest before stopping with "needs a human". */
  maxTargetFallbacks: 2,
  /** Agent tool-loop step cap per attempt. */
  maxAgentSteps: 24,
  /** Docs text handed to the agent per lookup. */
  maxDocsChars: 12_000,
  /** File text returned per read, and check output returned per run (tool output is data). */
  maxReadChars: 24_000,
  maxCheckOutputChars: 8_000,
  maxSearchHits: 60,
  /** Diff text handed to the review of a passing fix; review rounds before the rest goes under risks. */
  maxReviewDiffChars: 40_000,
  reviewRounds: 1,
  /** Output cap per agent step. */
  maxOutputTokens: 16_000,
} as const;

/**
 * Evidence decides the pull request (spec rule 13), never a model score:
 * only `verified` opens a ready PR; weaker evidence opens a draft that states what was not covered;
 * the rest open a "needs a human" issue with exact steps.
 */
export const PR_MODE_BY_EVIDENCE = {
  verified: "ready",
  typecheck_only: "draft",
  pre_existing_failure: "draft",
  needs_live_access: "draft",
  needs_local_service: "draft",
  environment_mismatch: "draft",
  regression: "issue",
  unverified: "issue",
  timeout: "issue",
} as const;
export type EvidenceKind = keyof typeof PR_MODE_BY_EVIDENCE;

export const PULL_REQUESTS = {
  /** Compare-and-swap attempts when a refreshed branch moved under Teire (review R4). */
  refSwapAttempts: 3,
  maxOpenPerRepo: 5,
  maxNewPerHour: 2,
  /** New "needs a human" issues one scan may open; the Dashboard issue lists the rest. */
  maxHumanIssuesPerScan: 3,
  /** GitHub's PR body limit. */
  bodyMaxChars: 65_536,
  /** GitHub check-run annotations per request. */
  annotationsPerCall: 50,
  branchPrefix: "teire",
  /** Base64 payload above which a commit goes through the Git Data API instead of GraphQL. */
  maxGraphqlCommitBytes: 5 * 1024 * 1024,
  /** Call sites shown per finding in a PR body before "and N more". */
  maxSitesPerFinding: 12,
  labels: ["teire"],
} as const;

export const RUNS = {
  /** Every installation checked against GitHub's own list of its repositories this often (worker). */
  reconcileMs: 30 * 60_000,
  /** Runs without a heartbeat for this long are failed by the reaper. */
  staleAfterMs: 10 * 60 * 1000,
  /** Another worker may take a running run only once its heartbeat is this old (review R13). */
  leaseMs: 2 * 60 * 1000,
  /** How long a worker that found the run held waits before looking again. */
  leaseRetrySeconds: 60,
  heartbeatEveryMs: 15 * 1000,
  /** How often a running run looks for a person's cancel (U1: stopped within 30 s). */
  cancelPollMs: 5 * 1000,
  /**
   * Fix runs the worker takes at once, each from a different repository (the queue keeps one per
   * repository in order). Each holds two sandboxes (Token Factory allows 50 per project) and up to
   * about 1 GB of the worker's 4 GB while it diffs an API; the resolver service queues its own jobs.
   * TEIRE_FIX_CONCURRENCY lowers it on a host shared with other services.
   */
  fixConcurrency: Number(process.env.TEIRE_FIX_CONCURRENCY ?? 3),
  /**
   * Scans the worker runs at once, each a different repository: one long scan (a monorepo) no longer
   * holds every other repository's first scan (Codex walk B27). TEIRE_SCAN_CONCURRENCY lowers it.
   */
  scanConcurrency: Number(process.env.TEIRE_SCAN_CONCURRENCY ?? 2),
  /** The run page polls this often while a run is active. */
  pollEveryMs: 1000,
  /**
   * A repository's Dashboard issue follows its runs at most this often: forty runs deferred at once
   * after a scan are one edit, not forty (GitHub's secondary limits, and an `issues.edited` each).
   */
  dashboardSyncMs: 30 * 1000,
} as const;

/**
 * A wide installation covers a whole account ("All repositories" on GitHub) with more than `repos`
 * repositories. The person picks on the welcome page instead: until a repository is picked (scanned
 * from the picker) or turned on, nothing is scanned on its own and no onboarding PR is opened, so an
 * account with hundreds of repositories gets no pull requests it did not ask for.
 */
export const WIDE_INSTALL = { repos: 10 } as const;

export const SCAN = {
  /** Largest repository tarball Teire will extract. */
  maxTarballBytes: 200 * 1024 * 1024,
  maxFiles: 20_000,
  /** Largest single file extracted from any archive (repos, package tarballs, wheels). */
  maxFileBytes: 50 * 1024 * 1024,
  /** Total bytes written when extracting one archive. */
  maxExtractedBytes: 1024 * 1024 * 1024,
  /**
   * Total bytes read out of one archive once decompressed: headers, metadata and entries skipped as
   * well as written ones (review round 2), so a gzip bomb stops here, not after reading it all.
   */
  maxExpandedBytes: 2 * 1024 * 1024 * 1024,
  /**
   * GitHub's `size` (KB) above which a repository isn't sent to a sandbox: public scans refuse it and
   * fix runs stop before any work (review R17); the tarball and its install would not fit.
   */
  maxRepoKb: 300 * 1024,
  /** Sources older than this make verdicts "inconclusive" instead of "not affected". */
  staleSourceAfterMs: 14 * 24 * 60 * 60 * 1000,
} as const;

export const PUBLIC_LIMITS = {
  scansPerUserPerDay: 3,
  dryRunsPerUserPerDay: 1,
  /**
   * A dry run that ended at one of these steps never ran a fix (the worker stopped, the limit, GitHub
   * didn't confirm it public, too large), so it doesn't use the day's dry run (Codex walk B10).
   */
  unspentDryRunSteps: ["interrupted", "limit", "not public", "too large"] as readonly string[],
  /** GitHub's `size` (KB) above which a public scan is refused (the same rule as fix runs). */
  maxRepoKb: SCAN.maxRepoKb,
} as const;

export const GITHUB = {
  /** Installation tokens last 1 h; refresh before that. */
  tokenRefreshMarginMs: 5 * 60 * 1000,
  /** Secondary rate limit: content-creating requests per minute. */
  contentWritesPerMinute: 80,
  webhookRedeliveryWindowMs: 3 * 24 * 60 * 60 * 1000,
} as const;

export const CATALOG = {
  userAgent: `TeireBot/0.1 (+${PUBLIC_URL}; provider change sources)`,
  fetchTimeoutMs: 20_000,
  /**
   * A provider's change sources are read when a scanned repo uses the provider, and reused by every
   * repo for this long (D82); nothing is read on a schedule.
   */
  freshForMs: 6 * 60 * 60 * 1000,
  /** A source that has not been read successfully for this long is shown as stale. */
  staleAfterMs: 24 * 60 * 60 * 1000,
  /** Verdicts depending on a stale source become "inconclusive" after this long (capability card C2). */
  inconclusiveAfterMs: 14 * 24 * 60 * 60 * 1000,
  /** Linked pages (Stripe change details, Token Factory notices) fetched at once per provider. */
  linkedFetchConcurrency: 6,
  /** Oldest Stripe API version whose breaking changes are catalogued. */
  stripeSince: "2019-01-01",
} as const;

/**
 * Providers with no reader (plan S04, D82): found from what the repo uses (an API host in its code,
 * an installed SDK's own base URL), their notice pages nominated by llms.txt and Otari's web search,
 * read by the reader model behind the quote gate.
 */
export const DISCOVERY = {
  /** A provider's discovered notice pages are reused this long before the search runs again. */
  freshForMs: 7 * 24 * 60 * 60 * 1000,
  /** …and this long when no deprecations page was found (search ranking varies between runs). */
  partialFreshForMs: 24 * 60 * 60 * 1000,
  /** Last resort for the deprecations page: these paths on the provider's busiest docs hosts. */
  probePaths: ["/docs/deprecations", "/deprecations"],
  probeHosts: 3,
  /** Direct dependencies whose published files are read for a default API base URL, per scan. */
  maxSdkPackages: 40,
  sdkConcurrency: 4,
  /** Per package: files and bytes of JS/Python read when looking for base URLs. */
  sdkMaxFiles: 12_000,
  sdkMaxBytes: 48 * 1024 * 1024,
  /** Notice pages read per provider (deprecations first, then changelogs). */
  maxPagesPerProvider: 3,
  /** Otari's web search and fetch (`/api/v1/search`, `/api/v1/fetch`). */
  search: {
    maxResults: 8,
    /** Otari's `search_domain_filter` takes at most 20 domains. */
    maxDomains: 20,
    timeoutMs: 30_000,
    /** The reader's list of results when search runs as Otari's built-in tool (8 URLs and titles). */
    listMaxTokens: 1500,
    /** A fetched page's text is cut here (Otari's built-in fetcher reads at most 5 MiB). */
    fetchMaxChars: 200_000,
  },
  /** Text sent to the reader per call; longer pages are read in heading-aligned chunks. */
  chunkChars: 32_000,
  maxChunks: 4,
  readerMaxOutputTokens: 16_000,
  /** A page whose own text is shorter than this is rendered by script: Otari's fetch reads it. */
  minPageChars: 1_500,
  /** Ambiguous model-ID sites (wrappers, registries) the reader traces per scan. */
  maxTriageSites: 24,
  triageMaxChars: 40_000,
} as const;

/**
 * OpenAPI diffs for APIs a repo calls over HTTP (plan S04, research cross-cutting.md §5). oasdiff is
 * pinned: its output differs materially between versions (v1.33.0 vs v1.34.1 on the same specs).
 */
export const OPENAPI = {
  oasdiff: { version: "1.34.1" },
  /** Checks that repeat one change through every expansion path (Stripe: 19,999 enum additions). */
  silenced: [
    "response-property-enum-value-added",
    "response-property-max-length-unset",
    "response-property-any-of-added",
  ],
  /** oasdiff levels: 3 ERR, 2 WARN; INFO never becomes a finding. */
  minLevel: 2,
  maxSpecBytes: 48 * 1024 * 1024,
  timeoutMs: 120_000,
  /** Repositories in the SDK owner's organisation that hold its API description. */
  repoQuery: "openapi OR oai OR api-description OR api-spec OR swagger in:name",
  /** A spec repository's discovery is reused this long. */
  repoFreshForMs: 7 * 24 * 60 * 60 * 1000,
  maxItemsPerOperation: 20,
  /** Response property paths deeper than this are expansions, not fields code reads. */
  maxResponseDepth: 3,
} as const;

/** Runtime end of life (endoflife.date). */
export const RUNTIMES = {
  /** A release line this close to its end of life is flagged ahead of the date. */
  warnDays: 180,
} as const;

/** Go (plan S05, research generic/go.md). */
export const GO = {
  /** Modules come from the proxy only (GOVCS=*:off): no git/hg/svn against hosts a go.mod names. */
  proxy: "https://proxy.golang.org",
  commandTimeoutMs: 180_000,
  helperTimeoutMs: 600_000,
  /** Bump when packages/helpers/go changes, so development rebuilds the cached binary. */
  helperVersion: "6",
  /** Highest major probed above the installed one (`/v5`, `/v6`, …) on the proxy. */
  maxMajorProbe: 6,
  /** govulncheck for advisory reachability (research go.md Job 9: v1.8.0 tested). */
  govulncheckVersion: "v1.8.0",
  /** golang.org/x/exp pseudo-version the helper pins (apidiff). */
  apidiffVersion: "v0.0.0-20261007192929-f45ad48fbe92",
  /** The sandbox image's Go: checks run with this toolchain (`GOTOOLCHAIN=local`). */
  sandboxGo: "1.27.2",
  /** The fix agent's `lookup_docs` answer from the target module's exported declarations. */
  docsLookupMaxItems: 25,
  docsLookupMaxChars: 7000,
  /** Lines of a struct or interface body shown with its declaration. */
  docsBodyLines: 18,
} as const;

/** Rust (plan S06, research generic/rust.md). */
export const RUST = {
  /** crates.io asks every client to identify itself (403 without a User-Agent). */
  userAgent: `TeireBot/0.1 (+${PUBLIC_URL}; dependency upgrades)`,
  semverChecksVersion: "0.51.0",
  /** rust-analyzer's SCIP index of one project at scan time (fetch, metadata guard, index). */
  scipTimeoutSec: 600,
  /** rustdoc JSON format versions cargo-semver-checks 0.51.0 reads ("supported formats are v57, v60, v61"). */
  rustdocFormats: [57, 60, 61] as number[],
  maxRustdocBytes: 256 * 1024 * 1024,
  /** The fix agent's `lookup_docs` answer from the target's rustdoc JSON. */
  docsLookupMaxItems: 25,
  docsLookupMaxChars: 7000,
  semverChecksTimeoutMs: 300_000,
  /** Route B compiles both versions and their dependency graphs (research: 109 s for async-openai). */
  routeBTimeoutSec: 1200,
  /** The sandbox's stable toolchain; checks never let rustup install another (RUSTUP_AUTO_INSTALL=0). */
  sandboxRust: "1.99.1",
} as const;

/** Ruby (plan S07, research generic/ruby.md). */
export const RUBY = {
  /** Version of Teire's Prism surface extractor; bump when its rules change (cached diffs). */
  extractorVersion: "2",
  maxGemBytes: 64 * 1024 * 1024,
  maxFileBytes: 2 * 1024 * 1024,
  /** The sandbox image's Ruby: the version an upgrade must run on when the repo pins none. */
  sandboxRuby: "4.0.9",
  /** The fix agent's `lookup_docs` answer from the target gem. */
  docsLookupMaxChars: 7000,
  /** A gem's version list is reused for this long within one worker process. */
  registryMemoMs: 10 * 60_000,
  /** `/api/v1/versions/<gem>.json` (one entry per platform; aws-sdk-core is ~2 MB). */
  maxVersionListBytes: 16 * 1024 * 1024,
} as const;

/** Java and Kotlin (plan S08, research jvm.md). */
export const JVM = {
  japicmpVersion: "0.26.3",
  japicmpUrl:
    "https://repo1.maven.org/maven2/com/github/siom79/japicmp/japicmp/0.26.3/japicmp-0.26.3-jar-with-dependencies.jar",
  japicmpSha1: "2452e6844f44657acd680656f78641205001bca0",
  japicmpTimeoutMs: 180_000,
  /** The fix agent's `lookup_docs` answer (API changes + the target's sources jar). */
  docsLookupMaxChars: 7000,
  maxJarBytes: 128 * 1024 * 1024,
  /** Central first, then Google's mirror of it (Sonatype rate-limits shared egress with 429s). */
  mavenMirrors: [
    "https://repo1.maven.org/maven2",
    "https://maven-central.storage-download.googleapis.com/maven2",
  ],
} as const;

/** Teire's sandbox service (apps/sandbox). Timeouts are set from context/11-build-notes/sandbox-measurements.md. */
export const SANDBOX = {
  /** Lifetime of a signed per-sandbox token. */
  tokenTtlSeconds: 15 * 60,
  /** One HTTP call to the service (start includes the tarball fetch). */
  requestTimeoutMs: 6 * 60 * 1000,
  /** Calls to the service retried on Cloudflare's transient Durable Object errors and dropped connections. */
  requestAttempts: 3,
  retryBackoffMs: 1500,
  /** How often a running job is polled for status and new log bytes. */
  pollIntervalMs: 2000,
} as const;

/** The guarded fetch routine (net/fetch.ts). */
export const NET = {
  userAgent: `TeireBot/0.1 (+${PUBLIC_URL})`,
  timeoutMs: 30_000,
  maxRedirects: 5,
  /** Default cap for one response; package tarballs pass their own larger cap. */
  maxResponseBytes: 32 * 1024 * 1024,
  /** A dropped connection or DNS hiccup is retried; an HTTP status never is (the caller decides). */
  networkRetries: 2,
  networkRetryMs: 750,
} as const;

/** Registry access and the target-version policy (plan D71). */
/** String-literal scan for model IDs and API hosts (ast-grep 0.50 plus config files). */
export const LITERALS = {
  timeoutMs: 120_000,
  maxOutputBytes: 64 * 1024 * 1024,
  /** Config files above this size (generated JSON, fixtures) are not searched. */
  maxConfigBytes: 512 * 1024,
} as const;

export const REGISTRY = {
  /** A version must be at least this old before Teire proposes it (repos may lower or raise it). */
  cooldownDays: 7,
  /** Largest package tarball Teire downloads for an API-surface diff. */
  maxTarballBytes: 100 * 1024 * 1024,
  /** deps.dev sends no ETag, only `cache-control: max-age=3600`; Teire reuses its answer this long. */
  depsDevTtlMs: 60 * 60 * 1000,
  /** npm's full package document ("over 10MB uncompressed" for some packages), fallback only. */
  maxPackumentBytes: 96 * 1024 * 1024,
  /** How many skipped newer versions a target decision lists per reason. */
  maxSkippedListed: 5,
  hosts: {
    depsDev: "api.deps.dev",
    npm: "registry.npmjs.org",
    pypi: "pypi.org",
    endoflife: "endoflife.date",
  },
  /** A native registry's version document (PyPI's JSON for boto3 runs to megabytes). */
  maxNativeBytes: 64 * 1024 * 1024,
  /** Where a registry dates each version with its own request (Go `.info`, a Maven pom), the newest this many. */
  nativeDatedVersions: 30,
  nativeConcurrency: 6,
  maxPomBytes: 1024 * 1024,
  /** Remote POMs one Maven project may read for its managed versions (Spring Boot's tree is ~40). */
  maxRemotePoms: 120,
  /** Maven repositories a JVM package's versions are read from when deps.dev doesn't know it. */
  maven: {
    central: { name: "Maven Central", url: "https://repo1.maven.org/maven2", hosts: ["repo1.maven.org"] },
    google: { name: "Google Maven", url: "https://dl.google.com/android/maven2", hosts: ["dl.google.com"] },
    pluginPortal: {
      name: "Gradle Plugin Portal",
      url: "https://plugins.gradle.org/m2",
      hosts: ["plugins.gradle.org", "plugins-artifacts.gradle.org"],
    },
  },
  /** Groups Google publishes on its own Maven repository, not Central. */
  googleMavenGroups: [
    "androidx",
    "android.arch",
    "com.android",
    "com.google.android",
    "com.google.firebase",
    "com.google.gms",
    "com.google.mlkit",
    "com.google.ar",
    "com.google.testing.platform",
  ],
  /** endoflife.date data changes when a release line is announced or retired; a day is fresh enough. */
  endoflifeTtlMs: 24 * 60 * 60 * 1000,
} as const;

/** API-surface diffs (plan S02a task 5; emend's measured bounds, refs/emend/src/surface.ts). */
export const SURFACE = {
  /** Where verified package tarballs are unpacked; one directory per name/version. */
  cacheDir: process.env.TEIRE_PACKAGE_CACHE ?? `${process.env.TMPDIR ?? "/tmp"}/teire-packages`,
  /** googleapis, the measured worst case, is 400,630 symbols; a cut-short walk never reports removals. */
  maxSymbols: 600_000,
  maxDepth: 12,
  maxSignatureChars: 4000,
  /** Longest alias expansion substituted into signatures before comparing. */
  maxAliasExpansion: 200,
  /** Type dependencies followed so re-exported declarations resolve (playwright → playwright-core). */
  typeDepDepth: 6,
  typeDepTotalCap: 500,
  typeDepFileCap: 4000,
  /** Wildcard `exports` entries expand to at most this many subpaths for existence checks. */
  maxWildcardFiles: 5000,
  /** Signature text kept per symbol inside a change record; the full diff stays in `surface_diffs`. */
  recordSignatureChars: 600,
  tool: "teire-dts-walker",
  toolVersion: "3+typescript@6.0.3",
  noiseFilterVersion: "2",
} as const;

/** Baseline-vs-after verification (card C5), from context/11-build-notes/sandbox-measurements.md. */
export const VERIFY = {
  workDir: "/work",
  installTimeoutSec: 600,
  /**
   * A JVM warm-up downloads the whole build's plugins and dependencies: a Jenkins plugin took 502 s on
   * Token Factory (live walk, explain-error-plugin), too close to the default.
   */
  jvmInstallTimeoutSec: 1_200,
  /** The scan-time compile and `teire-jvm refs` once the warm-up is done (S19). */
  jvmProbeTimeoutSec: 600,
  checkTimeoutSec: 300,
  /**
   * JVM test suites can be slow by design: a Jenkins plugin's JenkinsRule suite ran past 300 s on the
   * unchanged code (live walk, explain-error-plugin, 2026-10-28).
   */
  jvmCheckTimeoutSec: 1_200,
  /** Output kept per command for the classifier and the PR body. */
  outputTailChars: 20_000,
  /** Fetching a repository tarball and streaming it into a sandbox upload (up to `SCAN.maxTarballBytes`). */
  uploadTimeoutMs: 5 * 60_000,
} as const;

/** Release notes read by the reader model (S02a task 8). */
export const NOTES = {
  /** Total text sent to the model per upgrade (~20k tokens). */
  maxCharsToModel: 80_000,
  maxCharsPerDocument: 30_000,
  maxOutputTokens: 16_000,
  maxRemovedApisInPrompt: 60,
} as const;

/** Advisory matching (cross-cutting.md §2): OSV batch limit verified live (1,001 → HTTP 400). */
export const ADVISORIES = {
  osvBatchSize: 1000,
  detailConcurrency: 8,
  /** Packages per GHSA `affects` query, under URL length limits. */
  ghsaPackagesPerCall: 100,
  maxResponseBytes: 32 * 1024 * 1024,
  /** ruby-advisory-db as one tarball (~600 KB), reused for an hour (research ruby.md Job 9). */
  rubysecTarball: "https://codeload.github.com/rubysec/ruby-advisory-db/tar.gz/refs/heads/master",
  rubysecMaxBytes: 16 * 1024 * 1024,
  rubysecTtlMs: 60 * 60_000,
} as const;

/** Teire's Python helper (S03): the interpreter and pins it runs with outside the worker image. */
export const PYTHON = {
  version: "3.12",
  packages: ["packaging==26.3", "griffe==2.4.1", "jedi==0.20.1"],
  helperTimeoutMs: 180_000,
  /** Version of Teire's griffe step (join keys, guards); with griffe's own version it keys cached diffs. */
  surfaceTool: { name: "griffe", version: "2.4.1+teire3" },
} as const;

/**
 * The PR queue's order (D70, S15.9): security (0) → already broken (1) → dated within 90 days (2) →
 * majors with located use (3) → other majors (4) → plain bumps last (5).
 */
export const PRIORITY = {
  plainBump: 5,
} as const;
