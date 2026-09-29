import { count, eq } from "drizzle-orm";
import { db, schema } from "../db/index";
import { audit } from "../support/audit";
import { hasGlobalRole } from "../support/roles";
import type { Actor } from "./organizations";

export async function resetTwoFactor(userId: string, actor: Omit<Actor, "name">) {
  const [user] = await db
    .select({ id: schema.user.id, role: schema.user.role, totp: schema.user.twoFactorEnabled })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1);
  if (!user) return { status: "not_found" as const };
  if (hasGlobalRole(user.role, "admin")) return { status: "staff" as const };

  const [passkeys] = await db.select({ n: count() }).from(schema.passkey).where(eq(schema.passkey.userId, userId));
  await db.transaction(async (tx) => {
    await tx.delete(schema.twoFactor).where(eq(schema.twoFactor.userId, userId));
    await tx.delete(schema.passkey).where(eq(schema.passkey.userId, userId));
    await tx.update(schema.user).set({ twoFactorEnabled: false, hasPasskey: false }).where(eq(schema.user.id, userId));
    await tx.delete(schema.session).where(eq(schema.session.userId, userId));
  });

  await audit({
    ...actor,
    action: "user.two_factor.reset",
    targetType: "user",
    targetId: userId,
    metadata: { totp: user.totp === true, passkeys: passkeys?.n ?? 0 },
  });
  return { status: "reset" as const };
}
