import { getOrganizationDetail } from "../../../lib/admin/organizations";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const detail = await getOrganizationDetail(getRouterParam(event, "id")!);

  if (!detail) throw apiError(404, "ORGANIZATION_NOT_FOUND", "Organization not found");

  return detail;
});
