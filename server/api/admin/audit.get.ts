import { auditQuerySchema, queryAuditLog } from "../../lib/admin/audit-log";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  return queryAuditLog(parseQuery(event, auditQuerySchema));
});
