import { getSessionFromCtx } from "better-auth/api";
import type { HookContext } from "./hook-context";
import { audit, type AuditAction } from "../support/audit";

type Body = Record<string, unknown> & {
  organizationId?: string;
  userId?: string;
  memberId?: string;
  memberIdOrEmail?: string;
  role?: string | string[];
  roleName?: string;
  roleId?: string;
  permission?: unknown;
  data?: Record<string, unknown>;
  banReason?: string;
  banExpiresIn?: number;
};

const str = (v: unknown) => (typeof v === "string" ? v : undefined);

function auditableChanges(data: Record<string, unknown> | undefined) {
  if (!data || !("logo" in data)) return data ?? {};
  return { ...data, logo: data.logo ? "updated" : "removed" };
}

export async function auditAfterHook(ctx: HookContext) {
  const returned = ctx.context.returned as Record<string, unknown> | Error | undefined;
  if (returned instanceof Error) return;
  const path = ctx.path;
  const body = (ctx.body ?? {}) as Body;

  const tracked = [
    "/admin/impersonate-user",
    "/admin/stop-impersonating",
    "/admin/ban-user",
    "/admin/unban-user",
    "/admin/set-role",
    "/organization/update",
    "/organization/invite-member",
    "/organization/update-member-role",
    "/organization/remove-member",
    "/organization/create-role",
    "/organization/update-role",
    "/organization/delete-role",
  ];
  if (!tracked.includes(path)) return;

  const session = await getSessionFromCtx(ctx);
  const s = session?.session as { impersonatedBy?: string | null; activeOrganizationId?: string | null } | undefined;
  const actorId = session?.user.id ?? null;
  const impersonatedBy = s?.impersonatedBy ?? null;
  const organizationId = body.organizationId ?? s?.activeOrganizationId ?? null;

  const log = (action: AuditAction, extra: Parameters<typeof audit>[0] extends infer E ? Partial<E> : never) =>
    audit({ action, actorId, impersonatedBy, ...extra });

  switch (path) {
    case "/admin/impersonate-user":
      return log("impersonation.start", { targetType: "user", targetId: str(body.userId) });
    case "/admin/stop-impersonating":
      return audit({
        action: "impersonation.stop",
        actorId: impersonatedBy ?? actorId,
        impersonatedBy: null,
        targetType: "user",
        targetId: actorId,
      });
    case "/admin/ban-user":
      return log("user.ban", {
        targetType: "user",
        targetId: str(body.userId),
        metadata: { reason: body.banReason ?? null, expiresIn: body.banExpiresIn ?? null },
      });
    case "/admin/unban-user":
      return log("user.unban", { targetType: "user", targetId: str(body.userId) });
    case "/admin/set-role":
      return log("user.role.update", { targetType: "user", targetId: str(body.userId), metadata: { role: body.role } });
    case "/organization/update":
      return log("organization.update", {
        targetType: "organization",
        targetId: organizationId,
        organizationId,
        metadata: { changes: auditableChanges(body.data) },
      });
    case "/organization/invite-member": {
      const invitation = returned as { id?: string; email?: string; role?: string; organizationId?: string } | undefined;
      return log("invitation.create", {
        targetType: "invitation",
        targetId: invitation?.id,
        organizationId: invitation?.organizationId ?? organizationId,
        metadata: { email: invitation?.email ?? body.email, role: invitation?.role ?? body.role, resend: body.resend ?? false },
      });
    }
    case "/organization/update-member-role":
      return log("member.role.update", {
        targetType: "member",
        targetId: str(body.memberId),
        organizationId,
        metadata: { role: body.role },
      });
    case "/organization/remove-member": {
      const member = (returned as { member?: { id?: string; userId?: string } } | undefined)?.member;
      return log("member.remove", {
        targetType: "member",
        targetId: member?.id ?? str(body.memberIdOrEmail),
        organizationId,
        metadata: { userId: member?.userId ?? null },
      });
    }
    case "/organization/create-role":
      return log("role.create", {
        targetType: "role",
        targetId: str(body.role)?.toLowerCase(),
        organizationId,
        metadata: { permission: body.permission },
      });
    case "/organization/update-role":
      return log("role.update", {
        targetType: "role",
        targetId: str(body.roleName) ?? str(body.roleId),
        organizationId,
        metadata: { changes: body.data ?? {} },
      });
    case "/organization/delete-role":
      return log("role.delete", {
        targetType: "role",
        targetId: str(body.roleName) ?? str(body.roleId),
        organizationId,
      });
  }
}
