import { and, count, desc, eq, gte, notLike, sql } from "drizzle-orm";
import { db, schema } from "./db/index";
import { logoUrl, logoVersion } from "./org-profile";

const RECENT_ACTIVITY = 6;

export async function organizationInsights(organizationId: string) {
  const [[organization], [members], [pending], [roles], roleRows, activity] = await Promise.all([
    db
      .select({
        id: schema.organization.id,
        name: schema.organization.name,
        slug: schema.organization.slug,
        apps: schema.organization.apps,
        requireTwoFactor: schema.organization.requireTwoFactor,
        logoVersion,
      })
      .from(schema.organization)
      .where(eq(schema.organization.id, organizationId))
      .limit(1),
    db
      .select({
        total: count(),
        protected: sql<number>`count(*) filter (where coalesce(${schema.user.twoFactorEnabled}, false) or coalesce(${schema.user.hasPasskey}, false))::int`,
      })
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
    db.execute<{ role: string; n: number }>(
      sql`select trim(r) as role, count(*)::int as n
          from ${schema.member}, unnest(string_to_array(${schema.member.role}, ',')) as r
          where ${schema.member.organizationId} = ${organizationId}
          group by trim(r)`,
    ),
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

  return {
    organization: organization
      ? {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          apps: organization.apps ?? [],
          requireTwoFactor: organization.requireTwoFactor === true,
          logoUrl: logoUrl(organization.id, organization.logoVersion),
        }
      : null,
    stats: {
      members: members?.total ?? 0,
      twoFactorEnabled: members?.protected ?? 0,
      pendingInvitations: pending?.n ?? 0,
      customRoles: roles?.n ?? 0,
    },
    roleCounts: Object.fromEntries(roleRows.rows.map((r) => [r.role, Number(r.n)])) as Record<string, number>,
    recentActivity: activity,
  };
}
