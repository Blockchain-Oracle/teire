import { resolve } from "node:path";
import { createLocalDb, inArray, installations, repos, runMigrations } from "@teire/db";
import { WIDE_INSTALL } from "@teire/engine/constants";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isWideInstallation } from "../src/store";

/**
 * The wide-install gate against a real Postgres (TEIRE_TEST_DATABASE_URL, e.g. a throwaway
 * `postgres:17` container). Its first version counted 0 in production: a correlated subquery whose
 * columns Drizzle wrote unqualified, so the gate never closed and every repository was queued.
 */
const url = process.env.TEIRE_TEST_DATABASE_URL;
const local = url ? createLocalDb(url) : null;
const db = local?.db as NonNullable<typeof local>["db"];

const ALL = 990_001;
const SELECTED = 990_002;
const SMALL = 990_003;

async function install(id: number, selection: "all" | "selected", count: number, disabled = 0) {
  await db
    .insert(installations)
    .values({
      id,
      accountId: id,
      accountLogin: `acct-${id}`,
      accountType: "User",
      repositorySelection: selection,
    })
    .onConflictDoNothing();
  await db.insert(repos).values(
    Array.from({ length: count }, (_, i) => ({
      id: id * 1000 + i,
      installationId: id,
      fullName: `acct-${id}/repo-${i}`,
      defaultBranch: "main",
      status: i < disabled ? ("disabled" as const) : ("detected" as const),
    })),
  );
}

describe.skipIf(!url)("wide installations (Postgres)", () => {
  beforeAll(async () => {
    await runMigrations(db, resolve(__dirname, "../../../packages/db/drizzle"));
    await install(ALL, "all", WIDE_INSTALL.repos + 5);
    await install(SELECTED, "selected", WIDE_INSTALL.repos + 5);
    // Over the line only while the removed repositories are counted: they must not be.
    await install(SMALL, "all", WIDE_INSTALL.repos + 3, 4);
  });
  afterAll(async () => {
    await db.delete(repos).where(inArray(repos.installationId, [ALL, SELECTED, SMALL]));
    await db.delete(installations).where(inArray(installations.id, [ALL, SELECTED, SMALL]));
    await local?.pool.end();
  });

  it("is wide for a whole account with more repositories than the line", async () => {
    expect(await isWideInstallation(db, ALL)).toBe(true);
  });

  it("is never wide when the person chose repositories on GitHub", async () => {
    expect(await isWideInstallation(db, SELECTED)).toBe(false);
  });

  it("counts only repositories still in the installation", async () => {
    expect(await isWideInstallation(db, SMALL)).toBe(false);
  });

  it("is not wide for no installation or an unknown one", async () => {
    expect(await isWideInstallation(db, null)).toBe(false);
    expect(await isWideInstallation(db, 123)).toBe(false);
  });
});
