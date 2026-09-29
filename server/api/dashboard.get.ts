import { buildDashboard } from "../lib/dashboard";
import { hasGlobalRole } from "../lib/support/roles";

export default defineEventHandler(async (event) => {
  const session = await requireSession(event);
  const active = (session.session as { activeOrganizationId?: string | null }).activeOrganizationId ?? null;
  return buildDashboard(session.user.id, hasGlobalRole(session.user.role, "admin"), active);
});
