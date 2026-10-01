import { beforeEach, describe, expect, it } from "vitest";
import { agent, createUser, PASSWORD, resetDb, signedInAdmin, signIn } from "./helpers";
import { COMPROMISED_PASSWORD } from "./helpers/fake-idp";

describe("leaked passwords", () => {
  beforeEach(resetDb);

  it("refuses a password found in known data breaches", async () => {
    const user = await createUser();
    const a = await signIn(user.email);
    const leaked = await a
      .post("/api/auth/change-password")
      .send({ currentPassword: PASSWORD, newPassword: COMPROMISED_PASSWORD });

    expect(leaked.status).toBe(400);
    expect(leaked.body.code).toBe("PASSWORD_COMPROMISED");

    await a
      .post("/api/auth/change-password")
      .send({ currentPassword: PASSWORD, newPassword: "a-fresh-unique-passphrase" })
      .expect(200);
  });
});

describe("API reference", () => {
  beforeEach(resetDb);

  it("is only served to admins", async () => {
    await agent().get("/api/auth/reference").expect(404);
    await agent().get("/api/auth/open-api/generate-schema").expect(404);

    const user = await createUser();

    await (await signIn(user.email)).get("/api/auth/reference").expect(404);

    const { agent: admin } = await signedInAdmin();
    const page = await admin.get("/api/auth/reference").expect(200);

    expect(page.text).toContain("api-reference");
    const schema = await admin.get("/api/auth/open-api/generate-schema").expect(200);

    expect(schema.body.openapi).toBeDefined();
  });
});
