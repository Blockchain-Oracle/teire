import { endUsers, gatewayConfigFromEnv, ping, pingModel } from "@teire/engine/gateway";
import { gateway } from "@/lib/gateway";

/**
 * Health. Public: whether Otari is configured and answers (the key's own budget report, which costs
 * nothing), with the model each role asks for. With the operator's bearer (REVALIDATE_SECRET), one
 * real reader call through Otari as well, billed to the operator walk, so it can't be run up by anyone else.
 */
export async function GET(request: Request) {
  let models: ReturnType<typeof gatewayConfigFromEnv>["models"];
  try {
    models = gatewayConfigFromEnv().models;
  } catch (error) {
    return Response.json(
      { ok: false, otari: { configured: false, error: (error as Error).message } },
      { status: 503 },
    );
  }
  try {
    const reach = await ping(gateway());
    const secret = process.env.REVALIDATE_SECRET;
    const live = Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
    if (!live) return Response.json({ ok: true, otari: { configured: true, ...reach, models } });
    const call = await pingModel(await gateway().as(endUsers.operator));
    return Response.json({
      ok: true,
      otari: {
        configured: true,
        ...reach,
        models,
        call: {
          servedModel: call.servedModel,
          provider: call.provider,
          fallback: call.fallback,
          costUsd: call.costUsd,
          latencyMs: call.latencyMs,
          requestId: call.requestId,
        },
      },
    });
  } catch (error) {
    return Response.json(
      { ok: false, otari: { configured: true, error: (error as Error).message } },
      { status: 502 },
    );
  }
}
