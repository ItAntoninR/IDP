import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "../server/lib/db/index";
import {
  agent,
  countEmails,
  createUser,
  PASSWORD,
  resetDb,
  setupOrgWithOwner,
  uniqueEmail,
  waitForEmail,
  type Agent,
} from "./helpers";
import { fakeCode, type FakeProfile } from "./helpers/fake-idp";

const NEW_SIGN_IN = /Nouvelle connexion/;

async function signInWith(a: Agent, email: string, password = PASSWORD) {
  await a.post("/api/auth/sign-in/email").send({ email, password }).expect(200);
}

async function authentik(a: Agent, profile: Omit<FakeProfile, "nonce">) {
  const start = await a.post("/api/auth/sign-in/social").send({ provider: "authentik", callbackURL: "/" });
  const authUrl = new URL(start.body.url);
  const redirect = new URL(authUrl.searchParams.get("redirect_uri")!);
  const code = fakeCode({ ...profile, nonce: authUrl.searchParams.get("nonce") ?? undefined });

  return a.get(`${redirect.pathname}?code=${code}&state=${authUrl.searchParams.get("state")}`);
}

function totp(secret: string, at = Date.now()) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = [...secret.replace(/=+$/, "")].map((c) => alphabet.indexOf(c).toString(2).padStart(5, "0")).join("");
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);

  counter.writeUInt32BE(Math.floor(at / 30000), 4);
  const h = createHmac("sha1", key).update(counter).digest();
  const o = h[19]! & 15;

  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

describe("security alerts", () => {
  beforeEach(resetDb);

  it("warns about sign-ins from a new browser, not from the first or a known one", async () => {
    const user = await createUser();
    const laptop = agent();

    await signInWith(laptop, user.email);
    expect(await countEmails(user.email, NEW_SIGN_IN)).toBe(0);

    await signInWith(laptop, user.email);
    expect(await countEmails(user.email, NEW_SIGN_IN)).toBe(0);

    await signInWith(agent(), user.email);
    const mail = await waitForEmail(user.email, { subject: NEW_SIGN_IN });

    expect(mail.text).toContain("Mot de passe");
    expect(await countEmails(user.email, NEW_SIGN_IN)).toBe(1);
  });

  it("remembers browsers signed in through an external provider", async () => {
    const profile = { sub: `ak-${Date.now()}`, email: uniqueEmail("staff") };
    const first = agent();

    await authentik(first, profile);
    await authentik(first, profile);
    expect(await countEmails(profile.email, NEW_SIGN_IN)).toBe(0);

    await authentik(agent(), profile);
    const mail = await waitForEmail(profile.email, { subject: NEW_SIGN_IN });

    expect(mail.text).toContain("Authentik");
  });

  it("confirms password changes and second-factor changes", async () => {
    const user = await createUser();
    const a = agent();

    await signInWith(a, user.email);

    await a
      .post("/api/auth/change-password")
      .send({ currentPassword: PASSWORD, newPassword: "another-strong-password" })
      .expect(200);
    await waitForEmail(user.email, { subject: /mot de passe a été modifié/ });

    const enable = await a
      .post("/api/auth/two-factor/enable")
      .send({ password: "another-strong-password" })
      .expect(200);
    const secret = new URL(enable.body.totpURI).searchParams.get("secret")!;

    await a
      .post("/api/auth/two-factor/verify-totp")
      .send({ code: totp(secret) })
      .expect(200);
    await waitForEmail(user.email, { subject: /Double authentification activée/ });

    await a.post("/api/auth/two-factor/disable").send({ password: "another-strong-password" }).expect(200);
    await waitForEmail(user.email, { subject: /Double authentification désactivée/ });

    const entries = await db.select().from(schema.auditLog).where(eq(schema.auditLog.targetId, user.id));

    expect(entries.map((e) => e.action).sort()).toEqual(["user.two_factor.disable", "user.two_factor.enable"]);
    expect(entries.every((e) => e.actorId === user.id && e.impersonatedBy === null)).toBe(true);
  });

  it("records passkey removals in the audit log, including during impersonation", async () => {
    const { owner: ownerAgent, ownerEmail, adminAgent, admin } = await setupOrgWithOwner(["datahub"]);
    const [owner] = await db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.email, ownerEmail));
    const passkey = (id: string) => ({
      id,
      name: `Key ${id}`,
      publicKey: "public-key",
      userId: owner!.id,
      credentialID: `credential-${id}`,
      counter: 0,
      deviceType: "singleDevice",
      backedUp: false,
      createdAt: new Date(),
    });

    await db.insert(schema.passkey).values([passkey("pk-1"), passkey("pk-2")]);

    await ownerAgent.post("/api/auth/passkey/delete-passkey").send({ id: "pk-1" }).expect(200);

    await adminAgent.post("/api/auth/admin/impersonate-user").send({ userId: owner!.id }).expect(200);
    await adminAgent.post("/api/auth/passkey/delete-passkey").send({ id: "pk-2" }).expect(200);

    const entries = await db.select().from(schema.auditLog).where(eq(schema.auditLog.action, "user.passkey.remove"));

    expect(entries).toHaveLength(2);
    expect(entries.find((e) => (e.metadata as { passkeyId?: string }).passkeyId === "pk-1")).toMatchObject({
      actorId: owner!.id,
      impersonatedBy: null,
    });
    expect(entries.find((e) => (e.metadata as { passkeyId?: string }).passkeyId === "pk-2")).toMatchObject({
      actorId: owner!.id,
      impersonatedBy: admin.id,
    });
  });

  it("tells the user when support resets their second factors", async () => {
    const { ownerEmail, adminAgent } = await setupOrgWithOwner(["datahub"]);
    const [owner] = await db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.email, ownerEmail));

    await db.update(schema.user).set({ twoFactorEnabled: true }).where(eq(schema.user.id, owner!.id));
    await adminAgent.post(`/api/admin/users/${owner!.id}/two-factor/reset`).expect(200);
    await waitForEmail(ownerEmail, { subject: /réinitialisée/ });
  });
});
