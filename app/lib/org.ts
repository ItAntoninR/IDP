import type { PermissionState } from "./types";

export interface OrgMember {
  kind: "member";
  id: string;
  role: string;
  createdAt: string | Date;
  userId: string;
  user: { id: string; name: string; email: string };
  twoFactor: boolean;
}

export interface OrgInvitation {
  kind: "invitation";
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string | Date;
}

export type PeopleFilter = "all" | "members" | "pending" | "no2fa";

export interface PeoplePage {
  rows: (OrgMember | OrgInvitation)[];
  total: number;
  counts: { members: number; pending: number; withoutTwoFactor: number };
}

export interface DynamicRole {
  id: string;
  role: string;
  permission: PermissionState;
}

export interface ManagedOrganization {
  id: string;
  name: string;
  slug: string;
  apps: string[];
  requireTwoFactor: boolean;
}

export interface OrgRights {
  members: boolean;
  invite: boolean;
  roles: boolean;
  settings: boolean;
}

export const parsePermission = (p: unknown): PermissionState =>
  typeof p === "string" ? (JSON.parse(p) as PermissionState) : ((p ?? {}) as PermissionState);
