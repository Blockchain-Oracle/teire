export {
  type Ai,
  type CallOptions,
  type CallSettings,
  createGateway,
  type Gateway,
  type GatewayConfig,
  type GuardrailConfig,
  gatewayConfigFromEnv,
  type McpServer,
  type OtariTool,
  ping,
  pingModel,
  type Role,
} from "./client";
export {
  BalanceExhaustedError,
  BudgetExceededError,
  type BudgetScope,
  GatewayNotConfiguredError,
  GatewayRefusedError,
  GuardrailBlockedError,
  type GuardrailFinding,
  GuardrailUnavailableError,
  gatewayFetch,
  isAllowanceRefusal,
  refusalOf,
} from "./errors";
export { billedTo, type EndUser, endUsers } from "./identity";
export {
  type CallLike,
  type GatewayReceipt,
  type GuardrailVerdict,
  noReceipt,
  type OtariToolCall,
  otariMetadata,
  receiptOf,
  type StepReceipt,
  sumReceipts,
} from "./receipt";
export { createOtariRest, type FetchedPage, type KeyBudget, type OtariRest, type SearchResult } from "./rest";
