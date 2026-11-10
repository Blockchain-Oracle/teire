import { generateText, streamText } from "ai";
import { describe, expect, it } from "vitest";
import {
  BalanceExhaustedError,
  BudgetExceededError,
  createGateway,
  endUsers,
  GatewayRefusedError,
  GuardrailBlockedError,
  GuardrailUnavailableError,
  receiptOf,
  sumReceipts,
} from "../src/gateway";

/**
 * The gateway against a fake Otari that answers in Otari's real shapes
 * (context/02-otari-api-and-integrations/gateway-contract-for-teire.md): what the request carries,
 * what a receipt reads back, and how each refusal becomes a typed error.
 */
const CONFIG = {
  apiKey: "test-key",
  baseURL: "https://otari.test/api/v1",
  models: {
    fixer: "z-ai/glm-5.3",
    reviewer: "deepseek/deepseek-v4-pro-0813",
    reader: "deepseek/deepseek-v4.1-flash-1017",
    researcher: "minimax/minimax-m3",
    assistant: "openai/gpt-oss-120b",
  },
};

const COMPLETION = {
  id: "chatcmpl-1",
  object: "chat.completion",
  created: 1,
  model: "deepseek/deepseek-v4.1-flash-1017",
  choices: [{ index: 0, message: { role: "assistant", content: "ready" }, finish_reason: "stop" }],
  usage: {
    prompt_tokens: 12,
    completion_tokens: 3,
    total_tokens: 15,
    cost_usd: "0.000420",
    pricing_source: "deployment",
  },
  otari_tool_calls: [
    {
      id: "otari_ws_1",
      type: "web_search",
      status: "completed",
      query: "zod 4 migration",
      sources: [{ url: "https://zod.dev/v4" }],
    },
  ],
};

const SERVED = {
  "otari-request-id": "req_123",
  "otari-model": "glm-5p3",
  "otari-provider": "together",
  "otari-fallback": "true",
  "otari-attempt-count": "2",
  "otari-guardrails": JSON.stringify([
    { profile: "prompt-injection", mode: "monitor", valid: true, score: 0.02, status: "evaluated" },
  ]),
  "otari-end-user-budget": "bud_inst",
};

/** A fake Otari: budgets for the header, then the given chat answer; it keeps what it was sent. */
function fakeOtari(answer: () => Response) {
  const sent: { url: string; body: Record<string, unknown> | null; headers: Headers }[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    const headers = new Headers(input instanceof Request ? input.headers : init?.headers);
    const raw = input instanceof Request ? await input.clone().text() : init?.body;
    sent.push({ url, headers, body: typeof raw === "string" && raw ? JSON.parse(raw) : null });
    if (url.endsWith("/api/v1/end-user-budgets"))
      return Response.json([
        {
          budget_id: "bud_person",
          name: "teire-person-daily",
          end_user_count: 0,
          blocked_end_user_count: 0,
          is_default: true,
        },
        {
          budget_id: "bud_inst",
          name: "teire-installation-daily",
          end_user_count: 0,
          blocked_end_user_count: 0,
          is_default: false,
        },
      ]);
    return answer();
  }) as typeof fetch;
  return { fetchImpl, sent, chat: () => sent.find((s) => s.url.endsWith("/chat/completions")) };
}

describe("gateway requests and receipts", () => {
  it("bills the end user, tags the call, moves Otari's tools into `tools`, and reads the receipt back", async () => {
    const otari = fakeOtari(() => Response.json(COMPLETION, { headers: SERVED }));
    const gw = createGateway(CONFIG, otari.fetchImpl);
    const ai = await gw.as(endUsers.installation(42));
    const result = await generateText({
      ...ai.call("reader", { purpose: "notes", otariTools: [{ type: "otari_web_search", max_uses: 2 }] }),
      prompt: "Reply with the single word: ready",
    });

    const chat = otari.chat();
    expect(chat?.body).toMatchObject({
      model: "deepseek/deepseek-v4.1-flash-1017",
      user: "inst:42",
      metadata: { app: "teire", role: "reader", purpose: "notes" },
      tools: [{ type: "otari_web_search", max_uses: 2 }],
    });
    expect(chat?.body).not.toHaveProperty("otariTools");
    expect(chat?.headers.get("otari-end-user-budget")).toBe("bud_inst");

    const r = receiptOf(result);
    expect(r).toMatchObject({
      tokensIn: 12,
      tokensOut: 3,
      costUsd: 0.00042,
      pricingSource: "deployment",
      requestId: "req_123",
      servedModel: "glm-5p3",
      provider: "together",
      fallback: true,
      attempts: 2,
      endUserBudget: "bud_inst",
    });
    expect(r.guardrails[0]).toMatchObject({ profile: "prompt-injection", status: "evaluated" });
    expect(r.toolCalls[0]).toMatchObject({ type: "web_search", query: "zod 4 migration" });
  });

  it("sends no `user` and no budget header for a client billed to the key itself (the CLI)", async () => {
    const otari = fakeOtari(() => Response.json(COMPLETION, { headers: SERVED }));
    const ai = await createGateway(CONFIG, otari.fetchImpl).as(null);
    await generateText({ ...ai.call("fixer"), prompt: "hi" });
    expect(otari.chat()?.body).not.toHaveProperty("user");
    expect(otari.chat()?.headers.get("otari-end-user-budget")).toBeNull();
  });

  it("reads cost and Otari's tool calls from the last chunks of a stream", async () => {
    const chunks = [
      {
        id: "c",
        object: "chat.completion.chunk",
        created: 1,
        model: "m",
        choices: [{ index: 0, delta: { role: "assistant", content: "hi" } }],
      },
      {
        id: "c",
        object: "chat.completion.chunk",
        created: 1,
        model: "m",
        choices: [],
        otari_tool_calls: [{ id: "otari_wf_1", type: "web_fetch", status: "in_progress", url: "https://a" }],
      },
      {
        id: "c",
        object: "chat.completion.chunk",
        created: 1,
        model: "m",
        choices: [],
        otari_tool_calls: [{ id: "otari_wf_1", type: "web_fetch", status: "completed" }],
      },
      {
        id: "c",
        object: "chat.completion.chunk",
        created: 1,
        model: "m",
        choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
      },
      {
        id: "c",
        object: "chat.completion.chunk",
        created: 1,
        model: "m",
        choices: [],
        usage: {
          prompt_tokens: 5,
          completion_tokens: 1,
          total_tokens: 6,
          cost_usd: "0.000100",
          pricing_source: "deployment",
        },
      },
    ];
    const sse = `${chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join("")}data: [DONE]\n\n`;
    const otari = fakeOtari(
      () => new Response(sse, { headers: { "content-type": "text/event-stream", ...SERVED } }),
    );
    const ai = await createGateway(CONFIG, otari.fetchImpl).as(endUsers.person(7));
    const result = streamText({ ...ai.call("assistant"), prompt: "hi" });
    await result.consumeStream();
    const r = receiptOf({
      usage: await result.usage,
      providerMetadata: await result.providerMetadata,
      response: await result.response,
    });
    expect(otari.chat()?.body).toMatchObject({ user: "gh:7" });
    expect(r.costUsd).toBeCloseTo(0.0001, 6);
    expect(r.provider).toBe("together");
    expect(r.toolCalls).toEqual([
      { id: "otari_wf_1", type: "web_fetch", status: "completed", url: "https://a" },
    ]);
  });

  it("sums an agent's steps into one receipt", () => {
    const step = (cost: number, fallback: boolean) =>
      receiptOf({
        usage: { inputTokens: 10, outputTokens: 2 } as never,
        providerMetadata: { otari: { costUsd: cost, toolCalls: [] } },
        response: { headers: { "otari-fallback": String(fallback), "otari-attempt-count": "1" } },
      });
    const total = sumReceipts([step(0.01, false), step(0.02, true)]);
    expect(total).toMatchObject({ tokensIn: 20, tokensOut: 4, fallback: true, attempts: 2 });
    expect(total?.costUsd).toBeCloseTo(0.03, 6);
    expect(sumReceipts([])).toBeNull();
  });
});

describe("ordinary keys", () => {
  it("names no end user on a key that is not a service key (Otari would refuse the call)", async () => {
    const sent: { url: string; body: string | null }[] = [];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      const body = input instanceof Request ? await input.clone().text() : (init?.body as string | undefined);
      sent.push({ url, body: body ?? null });
      if (url.endsWith("/api/v1/end-user-budgets"))
        return Response.json({ detail: "This endpoint requires a service key." }, { status: 403 });
      return Response.json(COMPLETION, { headers: SERVED });
    }) as typeof fetch;
    const ai = await createGateway(CONFIG, fetchImpl).as(endUsers.person(5));
    expect(ai.endUser).toBeNull();
    await generateText({ ...ai.call("reader"), prompt: "hi" });
    const chat = sent.find((s) => s.url.endsWith("/chat/completions"));
    expect(JSON.parse(chat?.body ?? "{}")).not.toHaveProperty("user");
  });
});

describe("gateway refusals", () => {
  const refuse = async (res: () => Response) => {
    const otari = fakeOtari(res);
    const ai = await createGateway(CONFIG, otari.fetchImpl).as(endUsers.person(1));
    return generateText({ ...ai.call("assistant"), prompt: "hi", maxRetries: 0 }).then(
      () => null,
      (error: unknown) => error,
    );
  };

  it("an end user's spent allowance: scope, who, and when it comes back", async () => {
    const error = await refuse(() =>
      Response.json(
        { detail: "End user 'gh:1' has exceeded budget limit", code: "budget_exceeded", end_user: "gh:1" },
        {
          status: 403,
          headers: {
            "Otari-Error-Code": "budget_exceeded",
            "Otari-Budget-Scope": "user",
            "Retry-After": "3600",
            "Otari-Request-ID": "req_9",
          },
        },
      ),
    );
    expect(error).toBeInstanceOf(BudgetExceededError);
    const e = error as BudgetExceededError;
    expect(e).toMatchObject({ scope: "user", endUser: "gh:1", retryAfterSec: 3600, requestId: "req_9" });
    expect(e.resetsAt(0)?.getTime()).toBe(3_600_000);
  });

  it("the service's own ceiling names the key, not a person", async () => {
    const error = await refuse(() =>
      Response.json(
        { detail: "API key has exceeded budget limit", code: "budget_exceeded" },
        { status: 403, headers: { "Otari-Budget-Scope": "api_token" } },
      ),
    );
    expect(error).toMatchObject({ scope: "api_token", endUser: null });
  });

  it("a guardrail block, whose code is nested under `detail`", async () => {
    const error = await refuse(() =>
      Response.json(
        {
          detail: {
            message: "Request blocked by guardrail policy.",
            code: "guardrail_violation",
            guardrails: [
              { profile: "prompt-injection", explanation: "ignore previous instructions", score: 0.97 },
            ],
          },
        },
        { status: 403 },
      ),
    );
    expect(error).toBeInstanceOf(GuardrailBlockedError);
    expect((error as GuardrailBlockedError).guardrails[0]).toMatchObject({
      profile: "prompt-injection",
      score: 0.97,
    });
  });

  it("a guardrail that could not run, a spent balance and a blocked end user", async () => {
    expect(
      await refuse(() =>
        Response.json(
          { detail: "guardrail profile 'prompt-injection' could not be evaluated" },
          { status: 502 },
        ),
      ),
    ).toBeInstanceOf(GuardrailUnavailableError);
    expect(
      await refuse(() => Response.json({ detail: "Add funds", code: "insufficient_funds" }, { status: 402 })),
    ).toBeInstanceOf(BalanceExhaustedError);
    const blocked = await refuse(() =>
      Response.json(
        { detail: "End user 'gh:1' is blocked", code: "user_blocked" },
        { status: 403, headers: { "Otari-Error-Code": "user_blocked" } },
      ),
    );
    expect(blocked).toBeInstanceOf(GatewayRefusedError);
    expect((blocked as GatewayRefusedError).code).toBe("user_blocked");
  });

  it("leaves a provider failure to the SDK (not a refusal)", async () => {
    const error = await refuse(() =>
      Response.json({ detail: "The provider failed the request with HTTP 500" }, { status: 502 }),
    );
    expect(error).not.toBeInstanceOf(GuardrailUnavailableError);
    expect((error as Error).name).toMatch(/APICallError|RetryError/);
  });
});

describe("end users", () => {
  it("names people, installations and Teire's shared reading stably", () => {
    expect(endUsers.person(123)).toEqual({ id: "gh:123", budget: "teire-person-daily" });
    expect(endUsers.installation("180571981")).toEqual({
      id: "inst:180571981",
      budget: "teire-installation-daily",
    });
    expect(endUsers.catalog.id).toBe("teire:catalog");
    expect(endUsers.operator.budget).toBe("teire-operator-daily");
  });
});
