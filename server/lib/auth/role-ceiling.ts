import { APIError, getSessionFromCtx } from "better-auth/api";
import type { HookContext } from "./hook-context";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index";
import { appsOutsideCeiling, type PermissionMap } from "../../../shared/permissions";

export async function getOrgApps(organizationId: string): Promise<string[] | null> {
  const [org] = await db
    .select({ apps: schema.organization.apps })
    .from(schema.organization)
    .where(eq(schema.organization.id, organizationId))
    .limit(1);
  if (!org) return null;
  return org.apps ?? [];
}

export async function resolveOrganizationId(
  ctx: HookContext,
  explicit: string | undefined,
): Promise<string | undefined> {
  if (explicit) return explicit;
  const session = await getSessionFromCtx(ctx);
  return (session?.session as { activeOrganizationId?: string | null } | undefined)?.activeOrganizationId ?? undefined;
}

type RoleBody = {
  organizationId?: string;
  permission?: PermissionMap;
  data?: { permission?: PermissionMap };
};

export function forbidCeilingEdits(ctx: HookContext) {
  if (ctx.path !== "/organization/update") return;
  const data = (ctx.body as { data?: Record<string, unknown> } | undefined)?.data;
  if (data && "apps" in data) {
    throw new APIError("FORBIDDEN", {
      code: "APPS_CEILING_ADMIN_ONLY",
      message: "Only global admins can change the applications allowed for an organization",
    });
  }
}

export async function enforceRoleCeiling(ctx: HookContext) {
  let permission: PermissionMap | undefined;
  const body = (ctx.body ?? {}) as RoleBody;
  if (ctx.path === "/organization/create-role") permission = body.permission;
  else if (ctx.path === "/organization/update-role") permission = body.data?.permission;
  else return;
  if (!permission) return;

  const organizationId = await resolveOrganizationId(ctx, body.organizationId);
  if (!organizationId) return;
  const apps = await getOrgApps(organizationId);
  if (!apps) return;

  const outside = appsOutsideCeiling(permission, apps);
  if (outside.length) {
    throw new APIError("BAD_REQUEST", {
      code: "PERMISSION_OUTSIDE_CEILING",
      message: `Role grants permissions on apps not allowed for this organization: ${outside.join(", ")}`,
    });
  }
}
