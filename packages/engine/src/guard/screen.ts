import { generateText } from "ai";
import { SITE } from "../constants";
import {
  type Ai,
  type GatewayReceipt,
  GuardrailBlockedError,
  type GuardrailConfig,
  type GuardrailFinding,
  GuardrailUnavailableError,
  noReceipt,
  receiptOf,
} from "../gateway";
import { GUARD } from "./injection";

/**
 * Teire's prompt-injection guardrail as Otari runs it: `prompt-injection` on Teire's own guardrails
 * service (`/api/guardrails`), in block mode, so Otari refuses a request whose latest user message is
 * flagged before any model reads it. `TEIRE_GUARDRAIL_URL` points it elsewhere; `off` turns it off.
 * If the service can't be reached the request goes on unchecked (`on_unavailable: monitor`): a page
 * that can't be screened is no worse than before, and the run isn't stopped by Teire's own outage.
 */
export function injectionGuardrail(): GuardrailConfig | null {
  const url = process.env.TEIRE_GUARDRAIL_URL ?? `${SITE.url}/api/guardrails`;
  if (url === "off") return null;
  return { profile: GUARD.profile, url, mode: "block", on_unavailable: "monitor" };
}

export interface Screened {
  verdict: "passed" | "refused" | "unchecked";
  findings: GuardrailFinding[];
  receipt: GatewayReceipt;
}

/**
 * One text through Otari's guardrail on its own: a reader call whose only user message is the text,
 * asking for one token. A refusal costs nothing (Otari stops it before the model); a pass costs the
 * text's input tokens. Used to find which document of a refused batch carried the injection, and to
 * screen the researcher's brief, whose pages Otari's own tool loop fetched unscreened.
 */
export async function screen(ai: Ai, text: string, purpose: string): Promise<Screened> {
  const guard = injectionGuardrail();
  if (!guard) return { verdict: "unchecked", findings: [], receipt: noReceipt() };
  try {
    const result = await generateText({
      ...ai.call("reader", { purpose, guardrails: [guard] }),
      system: "Reply with the single word: ok",
      prompt: text.slice(0, GUARD.maxChars),
      maxOutputTokens: 1,
      maxRetries: 1,
    });
    const receipt = receiptOf(result);
    const unchecked = receipt.guardrails.some((g) => g.status === "unavailable");
    return { verdict: unchecked ? "unchecked" : "passed", findings: [], receipt };
  } catch (error) {
    if (error instanceof GuardrailBlockedError)
      return { verdict: "refused", findings: error.guardrails, receipt: noReceipt() };
    if (error instanceof GuardrailUnavailableError)
      return { verdict: "unchecked", findings: [], receipt: noReceipt() };
    throw error;
  }
}
