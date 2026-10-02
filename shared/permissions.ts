import { createAccessControl } from "better-auth/plugins/access";

export const APP_PERMISSIONS = {
  datahub: ["access", "export", "import", "import-read", "admin"],
  app: ["access", "admin"],
} as const;

export type AppId = keyof typeof APP_PERMISSIONS;

export const APP_IDS = Object.keys(APP_PERMISSIONS) as AppId[];

export const APP_LABELS: Record<AppId, string> = {
  datahub: "Data hub",
  app: "App",
};

export const ORG_PERMISSIONS = {
  organization: ["update"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  ac: ["create", "read", "update", "delete"],
  connector: ["create", "update", "delete"],
} as const;

export const statement = {
  ...ORG_PERMISSIONS,
  ...APP_PERMISSIONS,
} as const;

export const ac = createAccessControl(statement);

export const owner = ac.newRole({
  organization: ["update"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  ac: ["create", "read", "update", "delete"],
  connector: ["create", "update", "delete"],
  datahub: ["access", "export", "import", "import-read", "admin"],
  app: ["access", "admin"],
});

export const member = ac.newRole({
  ac: ["read"],
});

export const roles = { owner, member };

export const STATIC_ROLES = Object.keys(roles) as (keyof typeof roles)[];

export const CONNECTOR_APP: AppId = "datahub";

export const CONNECTOR_ACTION = "import";

export type PermissionMap = Partial<Record<string, string[]>>;

export const isAppId = (value: string): value is AppId => value in APP_PERMISSIONS;

export function clampToCeiling(perms: PermissionMap, allowedApps: readonly string[]): PermissionMap {
  const out: PermissionMap = {};

  for (const [resource, actions] of Object.entries(perms)) {
    if (!actions?.length) continue;
    if (isAppId(resource) && !allowedApps.includes(resource)) continue;
    out[resource] = [...actions];
  }

  return out;
}

export function appsOutsideCeiling(perms: PermissionMap, allowedApps: readonly string[]): AppId[] {
  return Object.entries(perms)
    .filter(([resource, actions]) => isAppId(resource) && actions?.length && !allowedApps.includes(resource))
    .map(([resource]) => resource as AppId);
}
