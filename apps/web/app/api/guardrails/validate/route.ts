import { detectInjection, GUARD } from "@teire/engine/guard/injection";

/**
 * Teire's guardrails service, in Otari's contract (`POST /validate {profile, input_text}` →
 * `{profile, result: {valid, explanation, score}}`). Otari calls it before forwarding a guarded
 * request (a release-notes reading, the researcher's brief) and refuses the request when `valid` is
 * false. Public, like any guardrail endpoint a request names: it reads the text it is sent and keeps
 * nothing. One profile, `prompt-injection`; any other answers inconclusive.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { profile?: unknown; input_text?: unknown } | null;
  const profile = typeof body?.profile === "string" ? body.profile : "";
  const text = typeof body?.input_text === "string" ? body.input_text : "";
  if (profile !== GUARD.profile)
    return Response.json({ profile, result: { valid: null, explanation: `unknown profile '${profile}'`, score: null } });
  const v = detectInjection(text);
  return Response.json({
    profile,
    result: {
      valid: !v.flagged,
      explanation: v.signals.length ? v.signals.join("; ") : null,
      score: v.score,
    },
  });
}
