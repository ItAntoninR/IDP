import { createAuthMiddleware } from "better-auth/api";
import { enforceRoleCeiling, forbidCeilingEdits } from "./role-ceiling";
import { stripOfflineAccessWhenImpersonating } from "./impersonation";
import { markOrganizationSelected } from "./org-selection";
import { auditAfterHook } from "./audit-hooks";
import { refuseMagicLinkWithTwoFactor, requirePasskeyUserVerification, syncHasPasskey } from "./two-factor-policy";

export const beforeHook = createAuthMiddleware(async (ctx) => {
  forbidCeilingEdits(ctx);
  await enforceRoleCeiling(ctx);
  await refuseMagicLinkWithTwoFactor(ctx);
  requirePasskeyUserVerification(ctx);
  return stripOfflineAccessWhenImpersonating(ctx);
});

export const afterHook = createAuthMiddleware(async (ctx) => {
  await markOrganizationSelected(ctx);
  await syncHasPasskey(ctx);
  await auditAfterHook(ctx);
});
