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

describe("organization name and logo", () => {
  beforeEach(resetDb);

  const update = (a: Agent, organizationId: string, data: Record<string, unknown>) =>
    a.post("/api/auth/organization/update").send({ organizationId, data });

  it("lets managers rename the organization and upload a logo served with caching", async () => {
    const { owner, organizationId } = await setupOrgWithOwner();
    await owner.post("/api/auth/organization/set-active").send({ organizationId }).expect(200);

    await update(owner, organizationId, { name: "  Acme Renamed  " }).expect(200);
    await update(owner, organizationId, { logo: `data:image/png;base64,${PIXEL}` }).expect(200);

    const insights = await owner.get("/api/account/organization").expect(200);
    expect(insights.body.organization.name).toBe("Acme Renamed");
    const logoUrl = insights.body.organization.logoUrl as string;
    expect(logoUrl).toMatch(new RegExp(`^/api/public/organizations/${organizationId}/logo\\?v=[0-9a-f]{12}$`));

    const context = await owner.get("/api/account/context").expect(200);
    expect(context.body.organizations[0].logoUrl).toBe(logoUrl);

    const image = await agent().get(logoUrl).buffer(true).expect(200);
    expect(image.headers["content-type"]).toBe("image/png");
    expect(image.headers["cache-control"]).toContain("immutable");
    expect(Buffer.compare(image.body as Buffer, Buffer.from(PIXEL, "base64"))).toBe(0);

    const entries = await auditActions("organization.update");
    expect(entries.map((e) => (e.metadata as { changes?: { logo?: string } }).changes?.logo)).toContain("updated");
    expect(JSON.stringify(entries)).not.toContain(PIXEL);

    await update(owner, organizationId, { logo: "" }).expect(200);
    expect((await owner.get("/api/account/organization").expect(200)).body.organization.logoUrl).toBeNull();
    await agent().get(`/api/public/organizations/${organizationId}/logo`).expect(404);
  });

  it("validates the name and the logo and keeps other fields for admins", async () => {
    const { owner, organizationId } = await setupOrgWithOwner();
    const svg = await update(owner, organizationId, { logo: "data:image/svg+xml;base64,PHN2Zy8+" });
    expect(svg.body.code).toBe("INVALID_LOGO");
    const script = await update(owner, organizationId, { logo: "javascript:alert(1)" });
    expect(script.body.code).toBe("INVALID_LOGO");
    const huge = await update(owner, organizationId, { logo: `data:image/png;base64,${"A".repeat(200_000)}` });
    expect(huge.body.code).toBe("LOGO_TOO_LARGE");
    const blank = await update(owner, organizationId, { name: "   " });
    expect(blank.body.code).toBe("INVALID_ORGANIZATION_NAME");
    const slug = await update(owner, organizationId, { slug: "hijacked" });
    expect(slug.status).toBe(403);
    expect(slug.body.code).toBe("ORGANIZATION_FIELD_ADMIN_ONLY");

    const member = await addMember(owner, organizationId);
    await update(member.agent, organizationId, { name: "Not allowed" }).expect(403);
  });

  it("shows logos in the admin list", async () => {
    const { owner, adminAgent, organizationId } = await setupOrgWithOwner();
    await update(owner, organizationId, { logo: `data:image/png;base64,${PIXEL}` }).expect(200);
    const list = await adminAgent.get("/api/admin/organizations").expect(200);
    expect(list.body.organizations[0].logoUrl).toMatch(/\/logo\?v=/);
    expect(JSON.stringify(list.body)).not.toContain(PIXEL);
    const detail = await adminAgent.get(`/api/admin/organizations/${organizationId}`).expect(200);
    expect(detail.body.organization).not.toHaveProperty("logo");
  });
});
