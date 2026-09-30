import { listOrganizations, listOrganizationsSchema } from "../../../lib/admin/organizations";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  return listOrganizations(parseQuery(event, listOrganizationsSchema));
});
