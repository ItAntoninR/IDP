import { audit } from "../support/audit";
import { twoFactorChange } from "./security-alerts";

type SessionContext =
  { context?: { session?: { session?: { impersonatedBy?: string | null } | null } | null } } | null | undefined;

const impersonatorOf = (ctx: SessionContext) => ctx?.context?.session?.session?.impersonatedBy ?? null;

export async function auditTwoFactorChange(
  user: { id: string; twoFactorEnabled?: boolean | null },
  ctx: (SessionContext & { path?: string }) | null | undefined,
) {
  const change = twoFactorChange(user, ctx?.path);

  if (!change) return;
  await audit({
    action: change === "enabled" ? "user.two_factor.enable" : "user.two_factor.disable",
    actorId: user.id,
    impersonatedBy: impersonatorOf(ctx),
    targetType: "user",
    targetId: user.id,
  });
}

export async function auditPasskeyChange(
  userId: string,
  change: "added" | "removed",
  details: { name?: string | null; passkeyId?: string | null },
  ctx: SessionContext,
) {
  await audit({
    action: change === "added" ? "user.passkey.add" : "user.passkey.remove",
    actorId: userId,
    impersonatedBy: impersonatorOf(ctx),
    targetType: "user",
    targetId: userId,
    metadata: Object.fromEntries(Object.entries(details).filter(([, value]) => value)),
  });
}
