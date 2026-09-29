import { APIError } from "better-auth/api";
import { and, eq, gt, sql } from "drizzle-orm";
import { db, schema } from "../db/index";
import { isSystemContext } from "../support/system-context";

export const AUTHENTIK_PROVIDER_ID = "authentik";

export interface HookCtx {
  path?: string;
  params?: Record<string, string | undefined>;
}

function isProviderCallback(ctx: HookCtx | null | undefined, providerId: string): boolean {
  if (!ctx?.path) return false;
  if (ctx.path === `/callback/${providerId}`) return true;
  return ctx.path.startsWith("/callback") && ctx.params?.id === providerId;
}

export const isAuthentikCallback = (ctx: HookCtx | null | undefined) => isProviderCallback(ctx, AUTHENTIK_PROVIDER_ID);

export async function hasPendingInvitation(email: string): Promise<boolean> {
  const rows = await db
    .select({ id: schema.invitation.id })
    .from(schema.invitation)
    .where(
      and(
        eq(sql`lower(${schema.invitation.email})`, email.toLowerCase()),
        eq(schema.invitation.status, "pending"),
        gt(schema.invitation.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function assertSignupAllowed(user: { email: string; emailVerified?: boolean }, ctx: HookCtx | null | undefined) {
  if (isSystemContext()) return;
  if (isAuthentikCallback(ctx)) return;
  if (isProviderCallback(ctx, "microsoft") && !user.emailVerified) {
    throw new APIError("FORBIDDEN", {
      code: "MICROSOFT_EMAIL_NOT_VERIFIED",
      message: "Microsoft did not verify this email: accept the invitation first, then link Microsoft",
    });
  }
  if (await hasPendingInvitation(user.email)) return;
  throw new APIError("FORBIDDEN", {
    code: "SIGNUP_REQUIRES_INVITATION",
    message: "Sign-up is by invitation only",
  });
}
