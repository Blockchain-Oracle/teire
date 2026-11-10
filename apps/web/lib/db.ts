import { createDb, createLocalDb } from "@teire/db";
import { attachDatabasePool } from "@vercel/functions";

/**
 * One pool per function instance, as the least-privilege `teire_web` role over TLS (verify-full
 * against the Coolify CA). `attachDatabasePool` releases idle clients before the function suspends.
 */
let instance: ReturnType<typeof createDb> | null = null;

export function database() {
  if (!instance) {
    const connectionString = process.env.DATABASE_URL;
    const caCert = process.env.DATABASE_CA_CERT;
    // Without TLS: a throwaway local Postgres in development, or the database on the host's private
    // container network (DATABASE_TLS=off; its port is never published). Otherwise verify the CA.
    const privateNetwork =
      process.env.DATABASE_TLS === "off" && !!connectionString && /@[a-z0-9-]+[:/]/.test(connectionString);
    if (connectionString && !caCert && (process.env.NODE_ENV === "development" || privateNetwork))
      instance = createLocalDb(connectionString, 3);
    else {
      if (!connectionString || !caCert) throw new Error("DATABASE_URL and DATABASE_CA_CERT must be set");
      // Every instance draws on `teire_web`'s one connection limit, and live pages poll it: few
      // clients each, closed soon after they go idle ("too many connections for role", Codex B9).
      instance = createDb({ connectionString, caCert, max: 3, idleTimeoutMillis: 5_000 });
    }
    attachDatabasePool(instance.pool);
  }
  return instance.db;
}
