import type { PermissionState } from "./types";

export interface OrgMember {
  id: string;
  role: string;
  createdAt: string | Date;
  userId: string;
  user: { id: string; name: string; email: string };
}

export interface OrgInvitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string | Date;
}

export interface DynamicRole {
  id: string;
  role: string;
  permission: PermissionState;
}

export interface FullOrganization {
  id: string;
  name: string;
  apps?: string[] | null;
  requireTwoFactor?: boolean | null;
  members: OrgMember[];
  invitations: OrgInvitation[];
}

export interface OrgRights {
  members: boolean;
  invite: boolean;
  roles: boolean;
  settings: boolean;
}

export const parsePermission = (p: unknown): PermissionState =>
  typeof p === "string" ? (JSON.parse(p) as PermissionState) : ((p ?? {}) as PermissionState);
