import { type Ai, createGateway, type EndUser, endUsers, type Gateway } from "@teire/engine/gateway";

/**
 * The worker's one Otari gateway (service key `OTARI_SERVICE_KEY`), made on first use so a worker
 * without a key still boots; every job binds it to whoever its model calls are billed to.
 */
let gw: Gateway | null = null;
export function gateway(): Gateway {
  gw ??= createGateway();
  return gw;
}

export const aiFor = (endUser: EndUser | null): Promise<Ai> => gateway().as(endUser);

/** An installation's scans, fix runs, CI repairs and re-verifies. */
export const installationAi = (installationId: number | null) =>
  aiFor(installationId == null ? null : endUsers.installation(installationId));

/** Teire's shared catalog reading (provider pages, release notes cached for everyone). */
export const catalogAi = () => aiFor(endUsers.catalog);
