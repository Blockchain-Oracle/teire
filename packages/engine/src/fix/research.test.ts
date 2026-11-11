import { APICallError } from "ai";
import { describe, expect, it } from "vitest";
import { RESEARCH } from "../constants";
import { otariSaid, rateLimitWait } from "./research";

const refused = (statusCode: number, headers: Record<string, string> = {}, body = "") =>
  new APICallError({
    message: statusCode === 429 ? "Too Many Requests" : "Bad Gateway",
    url: "https://api.otari.ai/api/v1/chat/completions",
    requestBodyValues: {},
    statusCode,
    responseHeaders: headers,
    responseBody: body,
  });

describe("rateLimitWait", () => {
  it("waits out Otari's Retry-After on a 429", () => {
    expect(rateLimitWait(refused(429, { "retry-after": "4" }))).toBe(4_000);
  });
  it("waits the default when a 429 names no time", () => {
    expect(rateLimitWait(refused(429))).toBe(RESEARCH.rateLimitWaitMs);
  });
  it("doesn't retry when the wait is longer than the cap", () => {
    expect(rateLimitWait(refused(429, { "retry-after": "120" }))).toBeNull();
  });
  it("doesn't retry anything but a 429", () => {
    expect(rateLimitWait(refused(502))).toBeNull();
    expect(
      rateLimitWait(new DOMException("The operation was aborted due to timeout", "TimeoutError")),
    ).toBeNull();
  });
});

describe("otariSaid", () => {
  it("adds Otari's body to the SDK's status text", () => {
    const said = otariSaid(refused(429, {}, '{"detail":"Rate limit exceeded for this key"}'));
    expect(said).toContain("Too Many Requests");
    expect(said).toContain("Rate limit exceeded for this key");
  });
});
