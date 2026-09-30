import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "../server/lib/db/index";
import {
  acceptInvitationAsNewUser,
  resetDb,
  setupOrgWithOwner,
  uniqueEmail,
  type Agent,
} from "./helpers";

const SEEDED_MEMBERS = 30;
const PENDING = 7;

interface PeopleRow {
  kind: "member" | "invitation";
  id: string;
  email?: string;
  user?: { email: string };
  twoFactor?: boolean;
}

const emailOf = (r: PeopleRow) => (r.kind === "member" ? r.user!.email : r.email!);

describe("organization people pagination", () => {
  let owner: Agent;
  let adminAgent: Agent;
  let organizationId: string;
  let ownerEmail: string;

  beforeAll(async () => {
    await resetDb();
    const org = await setupOrgWithOwner(["datahub"]);
    owner = org.owner;
    adminAgent = org.adminAgent;
    organizationId = org.organizationId;
    ownerEmail = org.ownerEmail;
    await owner.post("/api/auth/organization/set-active").send({ organizationId }).expect(200);

    const [ownerRow] = await db.select().from(schema.user).where(eq(schema.user.email, ownerEmail));
    const start = Date.now() + 1000;
    const users = Array.from({ length: SEEDED_MEMBERS }, (_, i) => ({
      id: randomUUID(),
      name: `Person ${String(i).padStart(2, "0")}`,
      email: `person-${String(i).padStart(2, "0")}@pagination.test`,
      emailVerified: true,
      twoFactorEnabled: i % 4 === 0,
      hasPasskey: i % 4 === 2,
    }));
    await db.insert(schema.user).values(users);
    await db.insert(schema.member).values(
      users.map((u, i) => ({
        id: randomUUID(),
        organizationId,
        userId: u.id,
        role: i < 5 ? "member,analyst" : "member",
        createdAt: new Date(start + i * 1000),
      })),
    );
    const invitation = (email: string, i: number, extra: Partial<typeof schema.invitation.$inferInsert> = {}) => ({
      id: randomUUID(),
      organizationId,
      email,
      role: "member",
      status: "pending",
      expiresAt: new Date(Date.now() + 86_400_000),
      createdAt: new Date(start + i * 1000),
      inviterId: ownerRow!.id,
      ...extra,
    });
    await db.insert(schema.invitation).values([
      ...Array.from({ length: PENDING }, (_, i) => invitation(`invitee-${i}@pagination.test`, i)),
      invitation("expired@pagination.test", 90, { expiresAt: new Date(Date.now() - 1000) }),
      invitation("canceled@pagination.test", 91, { status: "canceled" }),
    ]);
  });

  const people = (query: Record<string, string | number> = {}) =>
    owner.get("/api/account/organization/people").query(query);

  it("pages members first, then pending invitations, across the boundary", async () => {
    const first = await people({ limit: 25 }).expect(200);
    expect(first.body.total).toBe(SEEDED_MEMBERS + 1 + PENDING);
    expect(first.body.rows).toHaveLength(25);
    expect(first.body.rows.every((r: PeopleRow) => r.kind === "member")).toBe(true);
    expect(first.body.rows[0].user.email).toBe(ownerEmail);

    const second = await people({ limit: 25, offset: 25 }).expect(200);
    expect(second.body.rows.map((r: PeopleRow) => r.kind)).toEqual([
      ...Array(SEEDED_MEMBERS + 1 - 25).fill("member"),
      ...Array(PENDING).fill("invitation"),
    ]);

    const straddling = await people({ limit: 5, offset: 30 }).expect(200);
    expect(straddling.body.rows.map(emailOf)).toEqual([
      "person-29@pagination.test",
      "invitee-0@pagination.test",
      "invitee-1@pagination.test",
      "invitee-2@pagination.test",
      "invitee-3@pagination.test",
    ]);

    const seen = [...first.body.rows, ...second.body.rows].map((r: PeopleRow) => r.id);
    expect(new Set(seen).size).toBe(first.body.total);

    const beyond = await people({ limit: 25, offset: 100 }).expect(200);
    expect(beyond.body.rows).toEqual([]);
  });

  it("returns unfiltered counts for the filter tabs", async () => {
    const res = await people({ q: "person-0" }).expect(200);
    expect(res.body.counts).toEqual({ members: SEEDED_MEMBERS + 1, pending: PENDING, withoutTwoFactor: 16 });
  });

  it("filters pending invitations and hides expired or canceled ones", async () => {
    const res = await people({ filter: "pending", limit: 100 }).expect(200);
    expect(res.body.total).toBe(PENDING);
    expect(res.body.rows.every((r: PeopleRow) => r.kind === "invitation")).toBe(true);
    expect(res.body.rows.map(emailOf)).not.toContain("expired@pagination.test");
    expect(res.body.rows.map(emailOf)).not.toContain("canceled@pagination.test");
  });

  it("filters members without a second factor, counting passkeys as one", async () => {
    const res = await people({ filter: "no2fa", limit: 100 }).expect(200);
    expect(res.body.total).toBe(16);
    expect(res.body.rows.every((r: PeopleRow) => r.kind === "member" && r.twoFactor === false)).toBe(true);

    const members = await people({ filter: "members", limit: 100 }).expect(200);
    expect(members.body.total).toBe(SEEDED_MEMBERS + 1);
    const byEmail = Object.fromEntries(members.body.rows.map((r: PeopleRow) => [emailOf(r), r.twoFactor]));
    expect(byEmail["person-00@pagination.test"]).toBe(true);
    expect(byEmail["person-02@pagination.test"]).toBe(true);
    expect(byEmail["person-01@pagination.test"]).toBe(false);
  });

  it("searches members by name or email and invitations by email", async () => {
    const byEmail = await people({ q: "person-0", limit: 100 }).expect(200);
    expect(byEmail.body.total).toBe(10);

    const byName = await people({ q: "Person 1", limit: 100 }).expect(200);
    expect(byName.body.total).toBe(10);

    const invitation = await people({ q: "invitee-3" }).expect(200);
    expect(invitation.body.rows.map(emailOf)).toEqual(["invitee-3@pagination.test"]);

    const wildcard = await people({ q: "%" }).expect(200);
    expect(wildcard.body.total).toBe(0);
  });

  it("rejects page sizes above the maximum", async () => {
    const res = await people({ limit: 500 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("computes the insights with counts instead of loading every member", async () => {
    const res = await owner.get("/api/account/organization").expect(200);
    expect(res.body.organization).toMatchObject({ id: organizationId, apps: ["datahub"], requireTwoFactor: false });
    expect(res.body.stats).toMatchObject({ members: SEEDED_MEMBERS + 1, twoFactorEnabled: 15, pendingInvitations: PENDING });
    expect(res.body.roleCounts).toEqual({ owner: 1, member: SEEDED_MEMBERS, analyst: 5 });
    expect(res.body).not.toHaveProperty("twoFactor");
  });

  it("serves the same pages to admins, and to them only", async () => {
    const res = await adminAgent.get(`/api/admin/organizations/${organizationId}/people`).query({ filter: "members", limit: 10 }).expect(200);
    expect(res.body.total).toBe(SEEDED_MEMBERS + 1);
    expect(res.body.rows).toHaveLength(10);

    const detail = await adminAgent.get(`/api/admin/organizations/${organizationId}`).expect(200);
    expect(detail.body.counts).toEqual({ members: SEEDED_MEMBERS + 1, pendingInvitations: PENDING });
    expect(detail.body).not.toHaveProperty("members");

    await adminAgent.get("/api/admin/organizations/unknown/people").expect(404);
    await owner.get(`/api/admin/organizations/${organizationId}/people`).expect(403);
  });

  it("refuses plain members", async () => {
    const email = uniqueEmail("plain");
    const inv = await owner.post("/api/auth/organization/invite-member").send({ email, role: "member", organizationId }).expect(200);
    const member = await acceptInvitationAsNewUser(email, inv.body.id);
    await member.post("/api/auth/organization/set-active").send({ organizationId }).expect(200);
    await member.get("/api/account/organization/people").expect(403);
  });
});
