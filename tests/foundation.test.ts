import { beforeEach, describe, expect, it } from "vitest";
import { agent, createUser, extractLink, PASSWORD, resetDb, signIn, uniqueEmail, waitForEmail } from "./helpers/index";
import { db, schema } from "../server/lib/db/index";

async function invite(email: string) {
  const [org] = await db
    .insert(schema.organization)
    .values({ id: `org-${Date.now()}`, name: "Org", slug: `org-${Date.now()}`, createdAt: new Date() })
    .returning();
  const inviter = await createUser();

  await db.insert(schema.invitation).values({
    id: `inv-${Date.now()}`,
    organizationId: org!.id,
    email,
    role: "member",
    status: "pending",
    expiresAt: new Date(Date.now() + 3600_000),
    inviterId: inviter.id,
    createdAt: new Date(),
  });
}

describe("foundation", () => {
  beforeEach(resetDb);

  it("serves health endpoints", async () => {
    const a = agent();

    await a.get("/healthz").expect(200, { status: "ok" });
    await a.get("/api/auth/ok").expect(200);
  });

  it("requires email verification before password sign-in", async () => {
    const a = agent();
    const email = uniqueEmail();

    await invite(email);

    const signUp = await a.post("/api/auth/sign-up/email").send({ email, password: PASSWORD, name: "Alice" });

    expect(signUp.status).toBe(200);
    expect(signUp.body.token ?? null).toBeNull();

    const early = await a.post("/api/auth/sign-in/email").send({ email, password: PASSWORD });

    expect(early.status).toBe(403);

    const mail = await waitForEmail(email, { subject: /Confirmez/ });
    const { path } = extractLink(mail.text);

    expect(path).toContain("/api/auth/verify-email");
    expect([200, 302]).toContain((await a.get(path)).status);

    const session = await a.get("/api/auth/get-session").expect(200);

    expect(session.body.user.email).toBe(email);
    expect(session.body.user.emailVerified).toBe(true);

    const b = agent();
    const signInRes = await b.post("/api/auth/sign-in/email").send({ email, password: PASSWORD });

    expect(signInRes.status).toBe(200);
    const cookies = ([] as string[]).concat(signInRes.headers["set-cookie"] ?? []);
    const sessionCookie = cookies.find((c) => c.includes("session_token"));

    expect(sessionCookie).toMatch(/HttpOnly/i);
    expect(sessionCookie).toMatch(/SameSite=Lax/i);
    expect((await b.get("/api/auth/get-session").expect(200)).body.user.email).toBe(email);
  });

  it("rejects a wrong password", async () => {
    const user = await createUser();
    const res = await agent().post("/api/auth/sign-in/email").send({ email: user.email, password: "wrong-password" });

    expect(res.status).toBe(401);
  });

  it("signs in an existing user with a magic link", async () => {
    const user = await createUser();
    const a = agent();

    await a.post("/api/auth/sign-in/magic-link").send({ email: user.email, callbackURL: "/account" }).expect(200);

    const mail = await waitForEmail(user.email, { subject: /lien de connexion/ });
    const verify = await a.get(extractLink(mail.text).path);

    expect(verify.status).toBe(302);
    expect(verify.headers.location).toContain("/account");
    expect((await a.get("/api/auth/get-session").expect(200)).body.user.email).toBe(user.email);
  });

  it("resets a forgotten password", async () => {
    const user = await createUser();
    const a = agent();

    await a
      .post("/api/auth/request-password-reset")
      .send({ email: user.email, redirectTo: "/reset-password" })
      .expect(200);
    const mail = await waitForEmail(user.email, { subject: /Réinitialisation/ });
    const link = await a.get(extractLink(mail.text).path);

    expect(link.status).toBe(302);
    const token = new URL(link.headers.location ?? "", "http://x").searchParams.get("token");

    expect(token).toBeTruthy();

    await a.post("/api/auth/reset-password").send({ token, newPassword: "another-strong-password" }).expect(200);
    await agent().post("/api/auth/sign-in/email").send({ email: user.email, password: PASSWORD }).expect(401);
    await signIn(user.email, "another-strong-password");
  });
});
