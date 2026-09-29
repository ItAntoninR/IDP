import { getSessionFromCtx } from "better-auth/api";
import type { HookContext } from "./hook-context";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index";
import { countMemberships } from "./memberships";
import { twoFactorStatus } from "./two-factor-policy";

export const organizationSelectionField = {
  organizationSelectedAt: { type: "date", required: false, input: false },
} as const;

export async function markOrganizationSelected(ctx: HookContext) {
  if (ctx.path !== "/organization/set-active") return;
  if (ctx.context.returned instanceof Error) return;
  const sessionId = (await getSessionFromCtx(ctx))?.session.id;
  if (!sessionId) return;
  await db.update(schema.session).set({ organizationSelectedAt: new Date() }).where(eq(schema.session.id, sessionId));
}

const SELECTION_WINDOW_MS = 2 * 60 * 1000;

export async function needsOrganizationSelection({
  user,
  session,
}: {
  user: { id: string };
  session: Record<string, unknown>;
}): Promise<boolean> {
  const selectedAt = session.organizationSelectedAt ? new Date(session.organizationSelectedAt as string | Date).getTime() : 0;
  if (Date.now() - selectedAt < SELECTION_WINDOW_MS) return false;
  if (!session.impersonatedBy) {
    const twoFactor = await twoFactorStatus(user.id);
    if (twoFactor.requiredBy.length && !twoFactor.enabled) return true;
  }
  return (await countMemberships(user.id)) > 1;
}
