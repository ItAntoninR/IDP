import { APIError } from "better-auth/api";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "../db/index";
import { env } from "../env";
import { appByResource } from "../apps";
import { APP_PERMISSIONS, roles as staticRoles, type AppId } from "../../../shared/permissions";

export const ACCESS_CLAIM = `${env.CLAIMS_NAMESPACE}/access`;
export const IMPERSONATED_BY_CLAIM = `${env.CLAIMS_NAMESPACE}/impersonated_by`;
export const ORGANIZATION_CLAIM = `${env.CLAIMS_NAMESPACE}/org_id`;

export type AccessMap = Record<string, string[]>;

const parseRoles = (role: string) =>
  role
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);

export async function effectiveAppAccess(userId: string, appId: AppId): Promise<AccessMap> {
  const memberships = await db
    .select({
      organizationId: schema.member.organizationId,
      role: schema.member.role,
      apps: schema.organization.apps,
    })
    .from(schema.member)
    .innerJoin(schema.organization, eq(schema.organization.id, schema.member.organizationId))
    .where(eq(schema.member.userId, userId));

  const eligible = memberships.filter((m) => (m.apps ?? []).includes(appId));
  if (!eligible.length) return {};

  const dynamicRoles = await db
    .select({
      organizationId: schema.organizationRole.organizationId,
      role: schema.organizationRole.role,
      permission: schema.organizationRole.permission,
    })
    .from(schema.organizationRole)
    .where(
      and(
        inArray(
          schema.organizationRole.organizationId,
          eligible.map((m) => m.organizationId),
        ),
        inArray(
          schema.organizationRole.role,
          eligible.flatMap((m) => parseRoles(m.role)),
        ),
      ),
    );

  const catalogue = new Set<string>(APP_PERMISSIONS[appId]);
  const access: AccessMap = {};
  for (const m of eligible) {
    const granted = new Set<string>();
    for (const role of parseRoles(m.role)) {
      const fixed = staticRoles[role as keyof typeof staticRoles];
      for (const action of (fixed?.statements as Record<string, readonly string[]> | undefined)?.[appId] ?? []) {
        granted.add(action);
      }
      for (const d of dynamicRoles) {
        if (d.organizationId !== m.organizationId || d.role !== role) continue;
        const perms = JSON.parse(d.permission) as Record<string, string[]>;
        for (const action of perms[appId] ?? []) granted.add(action);
      }
    }
    const actions = new Set([...granted].filter((a) => catalogue.has(a)));
    if (actions.has("access")) {
      access[m.organizationId] = APP_PERMISSIONS[appId].filter((a) => actions.has(a));
    }
  }
  return access;
}

export async function buildAccessTokenClaims(info: {
  user?: { id: string; banned?: unknown } | null;
  resources?: string[];
  referenceId?: string;
}): Promise<Record<string, unknown>> {
  if (!info.user) return {};
  if (info.user.banned === true) {
    throw new APIError("FORBIDDEN", { error: "access_denied", error_description: "User is banned" });
  }
  const apps = (info.resources ?? []).map(appByResource);
  if (apps.length !== 1 || !apps[0]) {
    throw new APIError("BAD_REQUEST", {
      error: "invalid_target",
      error_description: "Exactly one known resource must be requested",
    });
  }
  const access = await effectiveAppAccess(info.user.id, apps[0].id);
  if (!Object.keys(access).length) {
    throw new APIError("FORBIDDEN", {
      error: "access_denied",
      error_description: "No organization grants access to this application",
    });
  }
  const granting = Object.keys(access);
  const organizationId = info.referenceId ?? (granting.length === 1 ? granting[0] : undefined);
  if (!organizationId) {
    throw new APIError("FORBIDDEN", {
      error: "access_denied",
      error_description: "An organization must be selected",
    });
  }
  const permissions = access[organizationId];
  if (!permissions) {
    throw new APIError("FORBIDDEN", {
      error: "access_denied",
      error_description: "The selected organization does not grant access to this application",
    });
  }
  return { [ACCESS_CLAIM]: { [organizationId]: permissions }, [ORGANIZATION_CLAIM]: organizationId };
}
