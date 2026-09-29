import type { BetterAuthPlugin } from "better-auth";
import { APIError, getSessionFromCtx } from "better-auth/api";
import { extendOAuthProvider } from "@better-auth/oauth-provider";
import { and, count, eq, sql } from "drizzle-orm";
import { db, schema } from "../db/index";
import type { HookContext } from "./hook-context";
import { impersonatorOf } from "./impersonation";

export async function organizationsRequiringTwoFactor(userId: string) {
  return db
    .select({ id: schema.organization.id, name: schema.organization.name })
    .from(schema.member)
    .innerJoin(schema.organization, eq(schema.organization.id, schema.member.organizationId))
    .where(and(eq(schema.member.userId, userId), eq(schema.organization.requireTwoFactor, true)));
}

export async function twoFactorStatus(userId: string) {
  const [[user], requiredBy] = await Promise.all([
    db
      .select({ totp: schema.user.twoFactorEnabled, passkey: schema.user.hasPasskey })
      .from(schema.user)
      .where(eq(schema.user.id, userId))
      .limit(1),
    organizationsRequiringTwoFactor(userId),
  ]);
  return {
    enabled: user?.totp === true || user?.passkey === true,
    totp: user?.totp === true,
    passkey: user?.passkey === true,
    requiredBy,
  };
}

export async function refuseMagicLinkWithTwoFactor(ctx: HookContext) {
  if (ctx.path !== "/sign-in/magic-link") return;
  const email = typeof ctx.body?.email === "string" ? ctx.body.email.toLowerCase() : null;
  if (!email) return;
  const [user] = await db
    .select({ id: schema.user.id, totp: schema.user.twoFactorEnabled, passkey: schema.user.hasPasskey })
    .from(schema.user)
    .where(sql`lower(${schema.user.email}) = ${email}`)
    .limit(1);
  if (!user) return;
  if (user.totp || user.passkey || (await organizationsRequiringTwoFactor(user.id)).length) {
    throw new APIError("FORBIDDEN", {
      code: "TWO_FACTOR_PASSWORD_REQUIRED",
      message: "This account signs in with a password and a second factor",
    });
  }
}

export const twoFactorTokenGuard = () =>
  ({
    id: "two-factor-token-guard",
    init(ctx) {
      extendOAuthProvider(ctx, {
        claims: {
          accessToken: async ({ user, sessionId }) => {
            if (!user) return {};
            const status = await twoFactorStatus(user.id);
            if (status.enabled || !status.requiredBy.length) return {};
            if (await impersonatorOf(sessionId)) return {};
            throw new APIError("FORBIDDEN", {
              error: "access_denied",
              error_description: "Two-factor authentication is required by the user's organization",
            });
          },
        },
      });
    },
  }) satisfies BetterAuthPlugin;

export async function syncHasPasskey(ctx: HookContext) {
  if (ctx.path !== "/passkey/verify-registration" && ctx.path !== "/passkey/delete-passkey") return;
  if (ctx.context.returned instanceof Error) return;
  const userId = (await getSessionFromCtx(ctx))?.user.id;
  if (!userId) return;
  const [row] = await db.select({ n: count() }).from(schema.passkey).where(eq(schema.passkey.userId, userId));
  await db.update(schema.user).set({ hasPasskey: (row?.n ?? 0) > 0 }).where(eq(schema.user.id, userId));
}

const USER_VERIFIED = 0x04;

export function userVerifiedFlag(authenticatorData: string): boolean {
  const bytes = Buffer.from(authenticatorData, "base64url");
  return bytes.length > 32 && (bytes[32]! & USER_VERIFIED) !== 0;
}

export function requirePasskeyUserVerification(ctx: HookContext) {
  if (ctx.path !== "/passkey/verify-authentication") return;
  const response = (ctx.body as { response?: { response?: { authenticatorData?: unknown } } } | undefined)?.response;
  const data = response?.response?.authenticatorData;
  if (typeof data !== "string" || !userVerifiedFlag(data)) {
    throw new APIError("UNAUTHORIZED", {
      code: "PASSKEY_USER_VERIFICATION_REQUIRED",
      message: "The passkey must verify the user (PIN or biometrics)",
    });
  }
}
