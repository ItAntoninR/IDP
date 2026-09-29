import { createAuthClient } from "better-auth/vue";
import {
  adminClient,
  inferOrgAdditionalFields,
  lastLoginMethodClient,
  magicLinkClient,
  organizationClient,
  twoFactorClient,
} from "better-auth/client/plugins";
import { oauthProviderClient } from "@better-auth/oauth-provider/client";
import { passkeyClient } from "@better-auth/passkey/client";
import { ac, roles } from "#shared/permissions";

export const authClient = createAuthClient({
  plugins: [
    organizationClient({
      ac,
      roles,
      dynamicAccessControl: { enabled: true },
      schema: inferOrgAdditionalFields({
        organization: {
          additionalFields: {
            apps: { type: "string[]", input: false, required: false },
            requireTwoFactor: { type: "boolean", input: true, required: false },
          },
        },
      }),
    }),
    adminClient(),
    magicLinkClient(),
    oauthProviderClient(),
    passkeyClient(),
    lastLoginMethodClient(),
    twoFactorClient({
      onTwoFactorRedirect() {
        window.location.href = `/two-factor${window.location.search}`;
      },
    }),
  ],
});

export const isGlobalAdmin = (user: unknown) =>
  ((user as { role?: string | null } | null | undefined)?.role ?? "").split(",").includes("admin");

export const impersonatorOf = (session: unknown) =>
  (session as { impersonatedBy?: string | null } | null | undefined)?.impersonatedBy ?? null;
