import "server-only";
import { account, and, eq } from "@teire/db";
import { type Ai, createGateway, endUsers, type Gateway } from "@teire/engine/gateway";
import { database } from "./db";

/**
 * The web's Otari gateway (server only: Otari's response headers aren't readable from a browser,
 * and the key never leaves the server). Made on first use, so pages render without a key.
 */
let gw: Gateway | null = null;
export function gateway(): Gateway {
  gw ??= createGateway();
  return gw;
}

/**
 * Ask Teire's client: billed to the person asking (`gh:<GitHub account id>`, their own daily
 * allowance on Otari), or to the operator walk's allowance when no one is signed in.
 */
export async function viewerAi(userId: string | null): Promise<Ai> {
  if (!userId) return gateway().as(endUsers.operator);
  const [row] = await database()
    .select({ id: account.accountId })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "github")))
    .limit(1);
  return gateway().as(row ? endUsers.person(row.id) : null);
}
