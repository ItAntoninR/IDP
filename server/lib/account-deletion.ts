import { APIError, getSessionFromCtx } from "better-auth/api";
import { eq } from "drizzle-orm";
import { db, schema } from "./db/index";
import { env } from "./env";
import { sendEmailInBackground } from "./email/mailer";
import { accountDeletedTemplate } from "./email/templates";
import { soleOwnedOrganizations } from "./org-ownership";
import { audit } from "./support/audit";
import { hasGlobalRole } from "./support/roles";
import type { HookContext } from "./auth/hook-context";

export const accountDeletionUrl = (token: string) => {
  const url = new URL("/account/delete", env.AUTH_BASE_URL);
  url.searchParams.set("token", token);
  return url.toString();
};

type Blocker = { code: "STAFF_ACCOUNT_MANAGED_IN_AUTHENTIK" } | { code: "SOLE_OWNER"; organizations: string[] };

export async function deletionBlocker(user: { id: string; role?: string | null }): Promise<Blocker | null> {
  if (hasGlobalRole(user.role ?? null, "admin")) return { code: "STAFF_ACCOUNT_MANAGED_IN_AUTHENTIK" };
  const owned = await soleOwnedOrganizations(user.id);
  return owned.length ? { code: "SOLE_OWNER", organizations: owned.map((o) => o.name) } : null;
}

function toApiError(blocker: Blocker) {
  if (blocker.code === "STAFF_ACCOUNT_MANAGED_IN_AUTHENTIK") {
    return new APIError("FORBIDDEN", { code: blocker.code, message: "Staff accounts are managed in Authentik" });
  }
  return new APIError("BAD_REQUEST", {
    code: blocker.code,
    message: `Transfer ownership first: ${blocker.organizations.join(", ")}`,
  });
}

export async function assertAccountDeletable(user: { id: string; role?: string | null }) {
  const blocker = await deletionBlocker(user);
  if (blocker) throw toApiError(blocker);
}

export async function refuseUndeletableAccounts(ctx: HookContext) {
  if (ctx.path !== "/delete-user") return;
  const session = await getSessionFromCtx(ctx);
  if (session) await assertAccountDeletable(session.user as { id: string; role?: string | null });
}

export async function onAccountDeleted(user: { id: string; email: string }) {
  sendEmailInBackground(user.email, accountDeletedTemplate(false));
  await audit({ action: "user.delete", actorId: user.id, targetType: "user", targetId: user.id, metadata: { by: "self" } });
}

type AdminDeletion =
  | { ok: true }
  | { ok: false; code: "USER_NOT_FOUND" | "YOU_CANNOT_REMOVE_YOURSELF" | Blocker["code"]; organizations?: string[] };

export async function deleteUserAsAdmin(userId: string, actor: { actorId: string; impersonatedBy: string | null }): Promise<AdminDeletion> {
  if (userId === actor.actorId) return { ok: false, code: "YOU_CANNOT_REMOVE_YOURSELF" };
  const [user] = await db
    .select({ id: schema.user.id, email: schema.user.email, role: schema.user.role })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1);
  if (!user) return { ok: false, code: "USER_NOT_FOUND" };
  const blocker = await deletionBlocker(user);
  if (blocker) return { ok: false, ...blocker };

  await db.delete(schema.user).where(eq(schema.user.id, userId));
  sendEmailInBackground(user.email, accountDeletedTemplate(true));
  await audit({ ...actor, action: "user.delete", targetType: "user", targetId: userId, metadata: { by: "admin" } });
  return { ok: true };
}
