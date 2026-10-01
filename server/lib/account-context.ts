import { eq } from "drizzle-orm";
import { auth } from "./auth";
import { db, schema } from "./db/index";
import { APPS } from "./apps";
import { effectiveAppAccess } from "./auth/access-claims";
import { twoFactorStatus } from "./auth/two-factor-policy";
import { isAppId, type AppId } from "../../shared/permissions";
import { logoUrl, logoVersion } from "./org-profile";

export async function userMemberships(userId: string) {
  const rows = await db
    .select({
      id: schema.organization.id,
      name: schema.organization.name,
      slug: schema.organization.slug,
      apps: schema.organization.apps,
      requireTwoFactor: schema.organization.requireTwoFactor,
      logoVersion,
      role: schema.member.role,
    })
    .from(schema.member)
    .innerJoin(schema.organization, eq(schema.organization.id, schema.member.organizationId))
    .where(eq(schema.member.userId, userId))
    .orderBy(schema.organization.name);

  return rows.map(({ logoVersion: version, ...o }) => ({
    ...o,
    logoUrl: logoUrl(o.id, version),
    requireTwoFactor: o.requireTwoFactor === true,
    apps: (o.apps ?? []).filter(isAppId).map((id) => ({ id, label: APPS[id].label, url: APPS[id].url })),
  }));
}

export async function organizationsGrantingApp(userId: string, appId: AppId) {
  const [memberships, access] = await Promise.all([userMemberships(userId), effectiveAppAccess(userId, appId)]);

  return memberships.filter((o) => access[o.id]);
}

export async function canManageOrganization(headers: Headers, organizationId: string) {
  const check = (permissions: Record<string, string[]>) =>
    auth.api
      .hasPermission({ headers, body: { organizationId, permissions } as never })
      .then((r) => (r as { success?: boolean }).success === true)
      .catch(() => false);
  const checks = await Promise.all([
    check({ member: ["update"] }),
    check({ invitation: ["create"] }),
    check({ ac: ["create"] }),
  ]);

  return checks.some(Boolean);
}

export async function accountContext(
  headers: Headers,
  userId: string,
  activeOrganizationId: string | null,
  impersonating: boolean,
) {
  const [organizations, twoFactor] = await Promise.all([userMemberships(userId), twoFactorStatus(userId)]);
  const active = organizations.find((o) => o.id === activeOrganizationId) ?? null;

  return {
    impersonating,
    twoFactor,
    organizations,
    active: active ? { ...active, canManage: await canManageOrganization(headers, active.id) } : null,
  };
}
