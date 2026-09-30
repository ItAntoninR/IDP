import { canManageOrganization } from "../../../lib/account-context";
import { listPeople, peopleQuerySchema } from "../../../lib/org-people";

export default defineEventHandler(async (event) => {
  const session = await requireSession(event);
  const organizationId = (session.session as { activeOrganizationId?: string | null }).activeOrganizationId;
  if (!organizationId) throw apiError(400, "NO_ACTIVE_ORGANIZATION", "No active organization");
  if (!(await canManageOrganization(event.headers, organizationId))) {
    throw apiError(403, "FORBIDDEN", "Management permission required");
  }
  return listPeople(organizationId, parseQuery(event, peopleQuerySchema));
});
