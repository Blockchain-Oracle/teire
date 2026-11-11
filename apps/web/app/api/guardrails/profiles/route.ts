import { GUARD } from "@teire/engine/guard/injection";

/** The profiles Teire's guardrails service serves (`GET /profiles`, optional in Otari's contract). */
export function GET() {
  return Response.json([{ name: GUARD.profile, guardrail_name: "teire-injection" }]);
}
