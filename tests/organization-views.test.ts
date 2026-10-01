import { beforeEach, describe, expect, it } from "vitest";
import { acceptInvitationAsNewUser, resetDb, setupOrgWithOwner, uniqueEmail } from "./helpers";

describe("organization views for managers", () => {
  beforeEach(resetDb);

  it("shows a manager the activity and insights of their active organization only", async () => {
    const first = await setupOrgWithOwner(["datahub"]);
    const second = await setupOrgWithOwner(["datahub"]);
    const email = uniqueEmail("member");

    await first.owner
      .post("/api/auth/organization/set-active")
      .send({ organizationId: first.organizationId })
      .expect(200);
    const inv = await first.owner
      .post("/api/auth/organization/invite-member")
      .send({ email, role: "member", organizationId: first.organizationId })
      .expect(200);

    await second.owner
      .post("/api/auth/organization/set-active")
      .send({ organizationId: second.organizationId })
      .expect(200);

    const audit = await first.owner
      .get("/api/account/organization/audit")
      .query({ organizationId: second.organizationId });

    expect(audit.status, JSON.stringify(audit.body)).toBe(200);
    expect(audit.body.entries.length).toBeGreaterThan(0);
    expect(audit.body.entries.every((e: { organizationId: string }) => e.organizationId === first.organizationId)).toBe(
      true,
    );

    const insights = await first.owner.get("/api/account/organization").expect(200);

    expect(insights.body.stats).toMatchObject({ members: 1, pendingInvitations: 1, twoFactorEnabled: 0 });

    const member = await acceptInvitationAsNewUser(email, inv.body.id);

    await member.post("/api/auth/organization/set-active").send({ organizationId: first.organizationId }).expect(200);
    await member.get("/api/account/organization/audit").expect(403);
    await member.get("/api/account/organization").expect(403);
  });
});
