import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db, schema } from "./db/index";
import { env } from "./env";
import { sendEmailInBackground } from "./email/mailer";
import { deleteAccountTemplate } from "./email/templates";
import { pseudonymizeUser } from "./account-lifecycle";
import { soleOwnedOrganizations } from "./org-ownership";
import { hasGlobalRole } from "./support/roles";

const TOKEN_TTL_MS = 60 * 60 * 1000;
const tokenIdentifier = (token: string) => `account-deletion:${createHash("sha256").update(token).digest("hex")}`;

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

type Failure<C extends string> = { ok: false; code: C; organizations?: string[] };
type Result<C extends string> = { ok: true } | Failure<C>;

const blocked = (blocker: Blocker): Failure<Blocker["code"]> =>
  blocker.code === "SOLE_OWNER"
    ? { ok: false, code: blocker.code, organizations: blocker.organizations }
    : { ok: false, code: blocker.code };

export async function requestAccountDeletion(user: {
  id: string;
  email: string;
  role?: string | null;
}): Promise<Result<Blocker["code"]>> {
  const blocker = await deletionBlocker(user);

  if (blocker) return blocked(blocker);
  const token = randomBytes(32).toString("base64url");

  await db.insert(schema.verification).values({
    id: randomUUID(),
    identifier: tokenIdentifier(token),
    value: user.id,
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
  });
  sendEmailInBackground(user.email, deleteAccountTemplate(accountDeletionUrl(token)));

  return { ok: true };
}

export async function confirmAccountDeletion(
  user: { id: string; role?: string | null },
  token: string,
): Promise<Result<"INVALID_TOKEN" | Blocker["code"]>> {
  const [verification] = await db
    .delete(schema.verification)
    .where(
      and(
        eq(schema.verification.identifier, tokenIdentifier(token)),
        eq(schema.verification.value, user.id),
        gt(schema.verification.expiresAt, new Date()),
      ),
    )
    .returning({ id: schema.verification.id });

  if (!verification) return { ok: false, code: "INVALID_TOKEN" };
  const blocker = await deletionBlocker(user);

  if (blocker) return blocked(blocker);
  await pseudonymizeUser(user.id, "self", { actorId: user.id });

  return { ok: true };
}

export async function deleteUserAsAdmin(
  userId: string,
  actor: { actorId: string; impersonatedBy: string | null },
): Promise<Result<"USER_NOT_FOUND" | "YOU_CANNOT_REMOVE_YOURSELF" | Blocker["code"]>> {
  if (userId === actor.actorId) return { ok: false, code: "YOU_CANNOT_REMOVE_YOURSELF" };
  const [user] = await db
    .select({ id: schema.user.id, role: schema.user.role })
    .from(schema.user)
    .where(and(eq(schema.user.id, userId), isNull(schema.user.deletedAt)))
    .limit(1);

  if (!user) return { ok: false, code: "USER_NOT_FOUND" };
  const blocker = await deletionBlocker(user);

  if (blocker) return blocked(blocker);
  await pseudonymizeUser(userId, "admin", actor);

  return { ok: true };
}
