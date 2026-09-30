import { beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, schema } from "../server/lib/db/index";
import {
  acceptInvitationAsNewUser,
  agent,
  createUser,
  extractLink,
  resetDb,
  setupOrgWithOwner,
  signedInAdmin,
  signIn,
  uniqueEmail,
  waitForEmail,
  type Agent,
} from "./helpers";

const PIXEL = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

async function addMember(owner: Agent, organizationId: string, role = "member") {
  const email = uniqueEmail("member");
  const inv = await owner.post("/api/auth/organization/invite-member").send({ email, role, organizationId }).expect(200);
  const member = await acceptInvitationAsNewUser(email, inv.body.id);
  await member.post("/api/auth/organization/set-active").send({ organizationId }).expect(200);
  const [row] = await db
    .select({ id: schema.member.id, userId: schema.member.userId })
    .from(schema.member)
    .innerJoin(schema.user, eq(schema.user.id, schema.member.userId))
    .where(and(eq(schema.member.organizationId, organizationId), eq(schema.user.email, email)));
  return { agent: member, email, memberId: row!.id, userId: row!.userId };
}

const memberRole = async (memberId: string) =>
  (await db.select({ role: schema.member.role }).from(schema.member).where(eq(schema.member.id, memberId)))[0]?.role;

const auditActions = async (action: string) => db.select().from(schema.auditLog).where(eq(schema.auditLog.action, action));

const userExists = async (email: string) => (await db.select().from(schema.user).where(eq(schema.user.email, email))).length > 0;

describe("admin invitations with any role", () => {
  beforeEach(resetDb);

  it("invites with a static or custom role and lists the organization roles", async () => {
    const { owner, adminAgent, organizationId } = await setupOrgWithOwner(["datahub"]);
    await owner
      .post("/api/auth/organization/create-role")
      .send({ organizationId, role: "analyst", permission: { datahub: ["access"] } })
      .expect(200);

    const detail = await adminAgent.get(`/api/admin/organizations/${organizationId}`).expect(200);
    expect(detail.body.roles).toEqual(["owner", "member", "analyst"]);

    const email = uniqueEmail("analyst");
    const res = await adminAgent.post(`/api/admin/organizations/${organizationId}/invitations`).send({ email, role: "analyst" }).expect(201);
    await waitForEmail(email, { subject: /Invitation/ });
    await acceptInvitationAsNewUser(email, res.body.invitationId);
    const [member] = await db
      .select({ role: schema.member.role })
      .from(schema.member)
      .innerJoin(schema.user, eq(schema.user.id, schema.member.userId))
      .where(eq(schema.user.email, email));
    expect(member?.role).toBe("analyst");

    const [entry] = (await auditActions("invitation.create")).filter((e) => e.targetId === res.body.invitationId);
    expect(entry?.metadata).toMatchObject({ email, role: "analyst" });
  });

  it("defaults to the owner role", async () => {
    const { adminAgent, organizationId } = await setupOrgWithOwner();
    const res = await adminAgent.post(`/api/admin/organizations/${organizationId}/invitations`).send({ email: uniqueEmail() }).expect(201);
    const [invitation] = await db.select().from(schema.invitation).where(eq(schema.invitation.id, res.body.invitationId));
    expect(invitation?.role).toBe("owner");
  });

  it("refuses unknown roles, existing members and non-admins", async () => {
    const { owner, adminAgent, organizationId, ownerEmail } = await setupOrgWithOwner();
    const unknown = await adminAgent.post(`/api/admin/organizations/${organizationId}/invitations`).send({ email: uniqueEmail(), role: "ghost" });
    expect(unknown.status).toBe(400);
    expect(unknown.body.code).toBe("UNKNOWN_ROLE");

    const existing = await adminAgent.post(`/api/admin/organizations/${organizationId}/invitations`).send({ email: ownerEmail, role: "member" });
    expect(existing.status).toBe(409);
    expect(existing.body.code).toBe("ALREADY_MEMBER");

    await adminAgent.post("/api/admin/organizations/unknown/invitations").send({ email: uniqueEmail() }).expect(404);
    await owner.post(`/api/admin/organizations/${organizationId}/invitations`).send({ email: uniqueEmail() }).expect(403);
  });
});
