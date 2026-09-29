export type PermissionState = Record<string, string[]>;

export interface LinkedAccount {
  id: string;
  providerId: string;
  accountId: string;
  createdAt: string | Date;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role?: string | null;
  banned?: boolean | null;
  banReason?: string | null;
  banExpires?: string | Date | null;
  twoFactorEnabled?: boolean | null;
  hasPasskey?: boolean | null;
  createdAt: string | Date;
}

export interface Dashboard {
  organization: {
    id: string;
    name: string;
    slug: string;
    role: string;
    memberCount: number;
    apps: string[];
    pendingInvitations: number | null;
  } | null;
  apps: { id: string; label: string; url: string; permissions: string[] }[];
  admin: {
    stats: {
      organizations: number;
      newOrganizations: number;
      users: number;
      newUsers: number;
      bannedUsers: number;
      pendingInvitations: number;
      staleInvitations: number;
    };
    appAccess: { id: string; label: string; organizations: number }[];
    signups: { week: string; count: number }[];
    recentActivity: { id: string; action: string; createdAt: string; actorName: string | null; actorEmail: string | null }[];
  } | null;
}

export interface OrganizationInsights {
  stats: { members: number; twoFactorEnabled: number; pendingInvitations: number; customRoles: number };
  twoFactor: Record<string, boolean>;
  recentActivity: {
    id: string;
    action: string;
    createdAt: string;
    metadata: Record<string, unknown>;
    actorName: string | null;
    actorEmail: string | null;
  }[];
}
