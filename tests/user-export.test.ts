import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "../server/lib/db/index";
import { agent, resetDb, setupOrgWithOwner, uniqueEmail, waitForEmail } from "./helpers";

describe("admin export of a user's data", () => {
  beforeEach(resetDb);

  async function setup() {
    const org = await setupOrgWithOwner(["datahub"]);
    const [owner] = await db.select().from(schema.user).where(eq(schema.user.email, org.ownerEmail));
    await db.insert(schema.passkey).values({
      id: randomUUID(),
      name: "MacBook",
      publicKey: "secret-public-key-material",
      userId: owner!.id,
      credentialID: "secret-credential-id",
      counter: 0,
      deviceType: "multiDevice",
      backedUp: true,
      createdAt: new Date(),
    });
    await db.insert(schema.knownDevice).values({
      id: randomUUID(),
      userId: owner!.id,
      deviceHash: "secret-device-hash",
      userAgent: "Mozilla/5.0 Firefox/131.0",
    });
    const invitee = uniqueEmail("invitee");
    await org.owner.post("/api/auth/organization/invite-member").send({ email: invitee, role: "member", organizationId: org.organizationId }).expect(200);
    return { ...org, ownerId: owner!.id, invitee };
  }

  it("downloads a JSON file with the user's data and no secrets", async () => {
    const { adminAgent, admin, ownerId, ownerEmail, organizationId, invitee } = await setup();
    const res = await adminAgent.get(`/api/admin/users/${ownerId}/export`).expect(200);

    expect(res.headers["content-disposition"]).toMatch(new RegExp(`attachment; filename="donnees-${ownerId}-\\d{4}-\\d{2}-\\d{2}\\.json"`));
    expect(res.headers["cache-control"]).toBe("no-store");
    const data = JSON.parse(res.text);

    expect(data.profile).toMatchObject({ id: ownerId, email: ownerEmail, emailVerified: true });
    expect(data.signInMethods).toEqual({ password: true, linkedAccounts: [] });
    expect(data.security.passkeys).toEqual([expect.objectContaining({ name: "MacBook", deviceType: "multiDevice", backedUp: true })]);
    expect(data.security.knownDevices).toContainEqual(expect.objectContaining({ userAgent: "Mozilla/5.0 Firefox/131.0" }));
    expect(data.sessions.length).toBeGreaterThan(0);
    expect(data.sessions[0]).toHaveProperty("ipAddress");
    expect(data.organizations).toEqual([expect.objectContaining({ organizationId, role: "owner" })]);
    expect(data.invitations.received).toEqual([expect.objectContaining({ role: "owner", status: "accepted" })]);
    expect(data.invitations.sent).toEqual([expect.objectContaining({ email: invitee, role: "member", status: "pending" })]);
    expect(data.activity).toContainEqual(expect.objectContaining({ action: "invitation.create", byUser: true, bySupport: false }));
    expect(data.notice).toContain("RGPD");

    const [credential] = await db.select().from(schema.account).where(eq(schema.account.userId, ownerId));
    const [session] = await db.select().from(schema.session).where(eq(schema.session.userId, ownerId));
    for (const secret of [credential!.password!, session!.token, "secret-public-key-material", "secret-credential-id", "secret-device-hash"]) {
      expect(res.text).not.toContain(secret);
    }

    const [entry] = await db.select().from(schema.auditLog).where(eq(schema.auditLog.action, "user.export"));
    expect(entry).toMatchObject({ actorId: admin.id, targetId: ownerId });
    await waitForEmail(ownerEmail, { subject: /copie de vos données/ });
  });

  it("is reserved to admins, including during impersonation", async () => {
    const { owner, adminAgent, ownerId } = await setup();
    await agent().get(`/api/admin/users/${ownerId}/export`).expect(401);
    await owner.get(`/api/admin/users/${ownerId}/export`).expect(403);
    await adminAgent.get("/api/admin/users/unknown/export").expect(404);

    await adminAgent.post("/api/auth/admin/impersonate-user").send({ userId: ownerId }).expect(200);
    await adminAgent.get(`/api/admin/users/${ownerId}/export`).expect(403);
    expect(await db.select().from(schema.auditLog).where(eq(schema.auditLog.action, "user.export"))).toHaveLength(0);
  });
});
