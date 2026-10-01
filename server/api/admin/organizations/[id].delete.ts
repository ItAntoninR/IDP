import { deleteOrganization, deleteOrganizationSchema } from "../../../lib/admin/organizations";

export default defineEventHandler(async (event) => {
  const session = await requireAdmin(event);
  const { confirm } = await parseBody(event, deleteOrganizationSchema);
  const result = await deleteOrganization(getRouterParam(event, "id")!, confirm, actorOf(session));

  if (!result.ok) {
    if (result.code === "ORGANIZATION_NOT_FOUND") throw apiError(404, result.code, "Organization not found");
    throw apiError(400, result.code, "Type the organization slug to confirm");
  }

  return { deleted: true };
});
