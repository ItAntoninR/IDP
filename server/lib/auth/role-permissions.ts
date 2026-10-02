import type { HookContext } from "./hook-context";
import { normalizeRolePermissions, type PermissionMap } from "../../../shared/permissions";

type RoleBody = Record<string, unknown> & {
  permission?: PermissionMap;
  data?: Record<string, unknown> & { permission?: PermissionMap };
};

export function normalizeRolePermissionsInBody(ctx: HookContext) {
  const body = (ctx.body ?? {}) as RoleBody;

  if (ctx.path === "/organization/create-role" && body.permission) {
    return { context: { ...ctx, body: { ...body, permission: normalizeRolePermissions(body.permission) } } };
  }

  if (ctx.path === "/organization/update-role" && body.data?.permission) {
    return {
      context: {
        ...ctx,
        body: { ...body, data: { ...body.data, permission: normalizeRolePermissions(body.data.permission) } },
      },
    };
  }
}
