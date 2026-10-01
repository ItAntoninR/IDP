import { beforeEach, describe, expect, it } from "vitest";
import { assertSignupAllowed } from "../server/lib/auth/signup-guard";
import { createOrganization, resetDb, signedInAdmin, uniqueEmail } from "./helpers";

const microsoftCallback = { path: "/callback/:id", params: { id: "microsoft" } };

describe("Microsoft sign-up", () => {
  beforeEach(resetDb);

  it("lets an invited person sign up with Microsoft only when Microsoft verified the email", async () => {
    const { agent } = await signedInAdmin();
    const ownerEmail = uniqueEmail("owner");

    await createOrganization(agent, { ownerEmail });

    await expect(
      assertSignupAllowed({ email: ownerEmail, emailVerified: false }, microsoftCallback),
    ).rejects.toMatchObject({
      body: { code: "MICROSOFT_EMAIL_NOT_VERIFIED" },
    });
    await expect(
      assertSignupAllowed({ email: ownerEmail, emailVerified: true }, microsoftCallback),
    ).resolves.toBeUndefined();
    await expect(
      assertSignupAllowed({ email: uniqueEmail("stranger"), emailVerified: true }, microsoftCallback),
    ).rejects.toMatchObject({ body: { code: "SIGNUP_REQUIRES_INVITATION" } });
  });
});
