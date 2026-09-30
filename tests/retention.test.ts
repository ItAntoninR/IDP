import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, pool, schema } from "../server/lib/db/index";
import { applyRetention, runRetentionOnce } from "../server/lib/account-lifecycle";
import { createUser, resetDb, signIn, waitForEmail } from "./helpers";

const DAY = 86_400_000;
const NOW = new Date();
const ago = (days: number) => new Date(NOW.getTime() - days * DAY);

async function makeUser(email: string, lastActiveAt: Date, extra: Partial<typeof schema.user.$inferInsert> = {}) {
  const id = randomUUID();
  await db.insert(schema.user).values({ id, name: email.split("@")[0]!, email, emailVerified: true, createdAt: ago(2000), lastActiveAt, ...extra });
  return id;
}

async function makeOrganization(ownerId: string) {
  const id = randomUUID();
  await db.insert(schema.organization).values({ id, name: `Org ${id.slice(0, 6)}`, slug: `org-${id.slice(0, 8)}`, createdAt: NOW });
  await db.insert(schema.member).values({ id: randomUUID(), organizationId: id, userId: ownerId, role: "owner", createdAt: NOW });
  return id;
}

const userRow = async (id: string) => (await db.select().from(schema.user).where(eq(schema.user.id, id)))[0]!;

describe("retention", () => {
  beforeEach(resetDb);

  it("purges audit entries, devices, archives, invitations and sessions past their retention", async () => {
    const userId = await makeUser("keeper@retention.test", NOW);
    const orgId = await makeOrganization(userId);
    await db.insert(schema.auditLog).values([
      { id: "old-audit", action: "role.create", createdAt: ago(366) },
      { id: "recent-audit", action: "role.create", createdAt: ago(300) },
    ]);
    await db.insert(schema.knownDevice).values([
      { id: "old-device", userId, deviceHash: "a", lastSeenAt: ago(401) },
      { id: "recent-device", userId, deviceHash: "b", lastSeenAt: ago(390) },
    ]);
    await db.insert(schema.deletedAccountArchive).values([
      { id: "old-archive", userId: "x", name: "x", email: "x@test", reason: "self", accountCreatedAt: ago(900), deletedAt: ago(366), expiresAt: ago(1) },
      { id: "recent-archive", userId: "y", name: "y", email: "y@test", reason: "self", accountCreatedAt: ago(900), deletedAt: ago(10), expiresAt: ago(-355) },
    ]);
    const invitation = { organizationId: orgId, role: "member", status: "pending", inviterId: userId };
    await db.insert(schema.invitation).values([
      { ...invitation, id: "old-invitation", email: "a@test", expiresAt: ago(1) },
      { ...invitation, id: "valid-invitation", email: "b@test", expiresAt: ago(-5) },
    ]);
    await db.insert(schema.session).values([
      { id: "old-session", token: "t1", userId, expiresAt: ago(1), updatedAt: ago(8) },
      { id: "live-session", token: "t2", userId, expiresAt: ago(-5), updatedAt: NOW },
    ]);

    const result = await applyRetention(NOW);
    expect(result).toMatchObject({ auditLog: 1, knownDevices: 1, archives: 1, invitations: 1, sessions: 1 });

    const ids = async (table: typeof schema.auditLog | typeof schema.knownDevice | typeof schema.deletedAccountArchive | typeof schema.invitation | typeof schema.session) =>
      (await db.select({ id: table.id }).from(table)).map((r) => r.id);
    expect(await ids(schema.auditLog)).toEqual(["recent-audit"]);
    expect(await ids(schema.knownDevice)).toEqual(["recent-device"]);
    expect(await ids(schema.deletedAccountArchive)).toEqual(["recent-archive"]);
    expect(await ids(schema.invitation)).toEqual(["valid-invitation"]);
    expect(await ids(schema.session)).toEqual(["live-session"]);
  });

  it("warns inactive accounts 30 days ahead, then pseudonymizes them", async () => {
    const active = await makeUser("active@retention.test", ago(100));
    const soon = await makeUser("soon@retention.test", ago(3 * 365 - 10));
    const due = await makeUser("due@retention.test", ago(3 * 365 + 5), { inactivityWarnedAt: ago(31) });
    const warnedRecently = await makeUser("recent-warning@retention.test", ago(3 * 365 + 5), { inactivityWarnedAt: ago(5) });
    const staff = await makeUser("staff@retention.test", ago(4 * 365), { role: "admin" });
    const soleOwner = await makeUser("owner@retention.test", ago(3 * 365 + 5), { inactivityWarnedAt: ago(31) });
    await makeOrganization(soleOwner);

    const result = await applyRetention(NOW);
    expect(result.accounts).toEqual({ warned: 1, deleted: 1, kept: 1 });

    expect((await userRow(active)).inactivityWarnedAt).toBeNull();
    expect((await userRow(soon)).inactivityWarnedAt).toBeInstanceOf(Date);
    await waitForEmail("soon@retention.test", { subject: /bientôt supprimé/ });

    expect(await userRow(due)).toMatchObject({ email: `deleted-${due}@deleted.invalid`, name: "Utilisateur supprimé" });
    const [archive] = await db.select().from(schema.deletedAccountArchive).where(eq(schema.deletedAccountArchive.userId, due));
    expect(archive).toMatchObject({ email: "due@retention.test", reason: "inactivity" });
    await waitForEmail("due@retention.test", { subject: /a été supprimé/ });

    expect((await userRow(warnedRecently)).deletedAt).toBeNull();
    expect((await userRow(staff)).deletedAt).toBeNull();
    const kept = await userRow(soleOwner);
    expect(kept.deletedAt).toBeNull();
    expect(kept.inactivityWarnedAt!.getTime()).toBe(NOW.getTime());
    const [entry] = await db.select().from(schema.auditLog).where(eq(schema.auditLog.action, "user.inactivity.kept"));
    expect(entry).toMatchObject({ targetId: soleOwner });

    const again = await applyRetention(NOW);
    expect(again.accounts).toEqual({ warned: 0, deleted: 0, kept: 0 });
  });

  it("records real sign-ins as activity and clears a pending warning", async () => {
    const user = await createUser();
    await db.update(schema.user).set({ lastActiveAt: ago(1000), inactivityWarnedAt: ago(3) }).where(eq(schema.user.id, user.id));
    await signIn(user.email);
    const row = await userRow(user.id);
    expect(row.inactivityWarnedAt).toBeNull();
    expect(row.lastActiveAt!.getTime()).toBeGreaterThan(Date.now() - 60_000);
  });

  it("runs on one instance at a time", async () => {
    const other = await pool.connect();
    try {
      await other.query("select pg_advisory_lock(hashtext('auth-service:retention'))");
      expect(await runRetentionOnce(NOW)).toBeNull();
    } finally {
      await other.query("select pg_advisory_unlock(hashtext('auth-service:retention'))");
      other.release();
    }
    expect(await runRetentionOnce(NOW)).not.toBeNull();
  });
});
