import { and, count, desc, eq, gte, notLike } from "drizzle-orm";
import { db, schema } from "./db/index";

const RECENT_ACTIVITY = 6;

export async function organizationInsights(organizationId: string) {
  const [members, [pending], [roles], activity] = await Promise.all([
    db
      .select({ userId: schema.member.userId, totp: schema.user.twoFactorEnabled, passkey: schema.user.hasPasskey })
      .from(schema.member)
      .innerJoin(schema.user, eq(schema.user.id, schema.member.userId))
      .where(eq(schema.member.organizationId, organizationId)),
    db
      .select({ n: count() })
      .from(schema.invitation)
      .where(
        and(
          eq(schema.invitation.organizationId, organizationId),
          eq(schema.invitation.status, "pending"),
          gte(schema.invitation.expiresAt, new Date()),
        ),
      ),
    db.select({ n: count() }).from(schema.organizationRole).where(eq(schema.organizationRole.organizationId, organizationId)),
    db
      .select({
        id: schema.auditLog.id,
        action: schema.auditLog.action,
        createdAt: schema.auditLog.createdAt,
        metadata: schema.auditLog.metadata,
        actorName: schema.user.name,
        actorEmail: schema.user.email,
      })
      .from(schema.auditLog)
      .leftJoin(schema.user, eq(schema.user.id, schema.auditLog.actorId))
      .where(and(eq(schema.auditLog.organizationId, organizationId), notLike(schema.auditLog.action, "impersonation.%")))
      .orderBy(desc(schema.auditLog.createdAt))
      .limit(RECENT_ACTIVITY),
  ]);

  const protectedMember = (m: (typeof members)[number]) => m.totp === true || m.passkey === true;
  const twoFactor = Object.fromEntries(members.map((m) => [m.userId, protectedMember(m)]));
  return {
    stats: {
      members: members.length,
      twoFactorEnabled: members.filter(protectedMember).length,
      pendingInvitations: pending?.n ?? 0,
      customRoles: roles?.n ?? 0,
    },
    twoFactor,
    recentActivity: activity,
  };
}
