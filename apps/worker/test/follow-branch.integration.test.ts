import { resolve } from "node:path";
import { createLocalDb, eq, runMigrations, runs } from "@teire/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { followBranch } from "../src/store";

/**
 * A queued run follows the branch (against a real Postgres, TEIRE_TEST_DATABASE_URL): a scan on a
 * newer commit moves a queued, unclaimed run to it, and leaves a claimed or running one alone.
 */
const url = process.env.TEIRE_TEST_DATABASE_URL;
const local = url ? createLocalDb(url) : null;
const db = local?.db as NonNullable<typeof local>["db"];

describe.skipIf(!url)("followBranch (Postgres)", () => {
  beforeAll(async () => {
    await runMigrations(db, resolve(__dirname, "../../../packages/db/drizzle"));
  });
  afterAll(async () => {
    await local?.pool.end();
  });

  const queued = async (group: string, extra: Partial<typeof runs.$inferInsert> = {}) => {
    const [row] = await db
      .insert(runs)
      .values({
        repoId: 7,
        kind: "fix",
        status: "queued",
        groupKey: group,
        fromVersion: "3.25.76",
        targetVersion: "4.6.7",
        baseSha: "old",
        idempotencyKey: `${group}-${Date.now()}-${Math.random()}`,
        ...extra,
      })
      .returning();
    if (!row) throw new Error("no run");
    return row;
  };
  const read = async (id: string) => (await db.select().from(runs).where(eq(runs.id, id)))[0];

  it("moves a queued run nobody holds to the scan's commit and installed version", async () => {
    const run = await queued("npm/zod/4.6.7");
    expect(await followBranch(db, 7, "npm/zod/4.6.7", "new", "3.25.80")).toBe(true);
    expect(await read(run.id)).toMatchObject({ baseSha: "new", fromVersion: "3.25.80" });
    // The same commit again changes nothing.
    expect(await followBranch(db, 7, "npm/zod/4.6.7", "new", "3.25.80")).toBe(false);
  });

  it("leaves a run a worker holds, or one already running, on its own commit", async () => {
    const held = await queued("npm/a/2.0.0", { workerId: "w:1:x", heartbeatAt: new Date() });
    const running = await queued("npm/b/2.0.0", { status: "running" });
    expect(await followBranch(db, 7, "npm/a/2.0.0", "new", null)).toBe(false);
    expect(await followBranch(db, 7, "npm/b/2.0.0", "new", null)).toBe(false);
    expect((await read(held.id))?.baseSha).toBe("old");
    expect((await read(running.id))?.baseSha).toBe("old");
  });
});
