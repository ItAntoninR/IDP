import { auditQuerySchema, queryAuditLog } from "../../../lib/admin/audit-log";
import { canManageOrganization } from "../../../lib/account-context";

export default defineEventHandler(async (event) => {
  const session = await requireSession(event);
  const organizationId = (session.session as { activeOrganizationId?: string | null }).activeOrganizationId;
  if (!organizationId) throw apiError(400, "NO_ACTIVE_ORGANIZATION", "No active organization");
  if (!(await canManageOrganization(event.headers, organizationId))) {
    throw apiError(403, "FORBIDDEN", "Management permission required");
  }
  const query = parseQuery(event, auditQuerySchema);
  const result = await queryAuditLog({ ...query, organizationId });
  return {
    total: result.total,
    entries: result.entries.map((e) => ({ ...e, impersonatedBy: e.impersonatedBy ? "support" : null })),
  };
});
