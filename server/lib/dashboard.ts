import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "./db/index";
import { APPS } from "./apps";
import { effectiveAppAccess } from "./auth/access-claims";
import { APP_IDS, isAppId } from "../../shared/permissions";

const RECENT_ACTIVITY = 6;
const TREND_DAYS = 30;
const STALE_INVITATION_DAYS = 3;
const SIGNUP_WEEKS = 12;
const DAY_MS = 24 * 60 * 60 * 1000;

const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS);

function startOfWeek(date: Date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));

  return d;
}

async function weeklySignups() {
  const firstWeek = startOfWeek(daysAgo((SIGNUP_WEEKS - 1) * 7));
  const rows = await db
    .select({ createdAt: schema.user.createdAt })
    .from(schema.user)
    .where(gte(schema.user.createdAt, firstWeek));
  const weeks = Array.from({ length: SIGNUP_WEEKS }, (_, i) => ({
    week: new Date(firstWeek.getTime() + i * 7 * DAY_MS).toISOString(),
    count: 0,
  }));

  for (const { createdAt } of rows) {
    const index = Math.floor((startOfWeek(createdAt).getTime() - firstWeek.getTime()) / (7 * DAY_MS));

    if (weeks[index]) weeks[index].count++;
  }

  return weeks;
}

const isOwner = (role: string) => role.split(",").some((r) => r.trim() === "owner");

async function activeOrganization(userId: string, organizationId: string | null) {
  if (!organizationId) return null;
  const rows = await db
    .select({
      id: schema.organization.id,
      name: schema.organization.name,
      slug: schema.organization.slug,
      apps: schema.organization.apps,
      role: schema.member.role,
      memberCount: sql<number>`(select count(*)::int from "member" m where m.organization_id = "organization"."id")`,
    })
    .from(schema.member)
    .innerJoin(schema.organization, eq(schema.organization.id, schema.member.organizationId))
    .where(and(eq(schema.member.userId, userId), eq(schema.member.organizationId, organizationId)))
    .limit(1);
  const org = rows[0];

  if (!org) return null;

  let pendingInvitations: number | null = null;

  if (isOwner(org.role)) {
    const [pending] = await db
      .select({ n: count() })
      .from(schema.invitation)
      .where(
        and(
          eq(schema.invitation.organizationId, org.id),
          eq(schema.invitation.status, "pending"),
          gte(schema.invitation.expiresAt, new Date()),
        ),
      );

    pendingInvitations = pending?.n ?? 0;
  }

  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    role: org.role,
    memberCount: org.memberCount,
    apps: (org.apps ?? []).filter(isAppId).map((id) => APPS[id].label),
    pendingInvitations,
  };
}

async function accessibleApps(userId: string, organizationId: string | null) {
  if (!organizationId) return [];
  const access = await Promise.all(APP_IDS.map(async (id) => ({ id, orgs: await effectiveAppAccess(userId, id) })));

  return access
    .filter((a) => a.orgs[organizationId])
    .map((a) => ({ id: a.id, label: APPS[a.id].label, url: APPS[a.id].url, permissions: a.orgs[organizationId]! }));
}

async function adminOverview() {
  const since = daysAgo(TREND_DAYS);
  const staleBefore = daysAgo(STALE_INVITATION_DAYS);
  const [[orgs], [users], [banned], [invitations], appRows, signups, activity] = await Promise.all([
    db
      .select({
        n: count(),
        recent: sql<number>`count(*) filter (where ${schema.organization.createdAt} >= ${since})::int`,
      })
      .from(schema.organization),
    db
      .select({ n: count(), recent: sql<number>`count(*) filter (where ${schema.user.createdAt} >= ${since})::int` })
      .from(schema.user),
    db.select({ n: count() }).from(schema.user).where(eq(schema.user.banned, true)),
    db
      .select({
        n: count(),
        stale: sql<number>`count(*) filter (where ${schema.invitation.createdAt} < ${staleBefore})::int`,
      })
      .from(schema.invitation)
      .where(and(eq(schema.invitation.status, "pending"), gte(schema.invitation.expiresAt, new Date()))),
    Promise.all(
      APP_IDS.map(async (id) => {
        const [row] = await db
          .select({ n: count() })
          .from(schema.organization)
          .where(sql`${id} = any(${schema.organization.apps})`);

        return { id, label: APPS[id].label, organizations: row?.n ?? 0 };
      }),
    ),
    weeklySignups(),
    db
      .select({
        id: schema.auditLog.id,
        action: schema.auditLog.action,
        createdAt: schema.auditLog.createdAt,
        actorName: schema.user.name,
        actorEmail: schema.user.email,
      })
      .from(schema.auditLog)
      .leftJoin(schema.user, eq(schema.user.id, schema.auditLog.actorId))
      .orderBy(desc(schema.auditLog.createdAt))
      .limit(RECENT_ACTIVITY),
  ]);

  return {
    stats: {
      organizations: orgs?.n ?? 0,
      newOrganizations: orgs?.recent ?? 0,
      users: users?.n ?? 0,
      newUsers: users?.recent ?? 0,
      bannedUsers: banned?.n ?? 0,
      pendingInvitations: invitations?.n ?? 0,
      staleInvitations: invitations?.stale ?? 0,
    },
    appAccess: appRows,
    signups,
    recentActivity: activity,
  };
}

export async function buildDashboard(userId: string, isAdmin: boolean, activeOrganizationId: string | null) {
  const [organization, apps, admin] = await Promise.all([
    activeOrganization(userId, activeOrganizationId),
    accessibleApps(userId, activeOrganizationId),
    isAdmin ? adminOverview() : Promise.resolve(null),
  ]);

  return { organization, apps, admin };
}
