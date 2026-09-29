import { updateOrganization, updateOrganizationSchema } from "../../../lib/admin/organizations";

export default defineEventHandler(async (event) => {
  const session = await requireAdmin(event);
  const input = await parseBody(event, updateOrganizationSchema);
  const organization = await updateOrganization(getRouterParam(event, "id")!, input, {
    ...actorOf(session),
    name: session.user.name || session.user.email,
  });
  if (!organization) throw apiError(404, "ORGANIZATION_NOT_FOUND", "Organization not found");
  return { organization };
});
