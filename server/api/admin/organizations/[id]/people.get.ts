import { eq } from "drizzle-orm";
import { db, schema } from "../../../../lib/db/index";
import { listPeople, peopleQuerySchema } from "../../../../lib/org-people";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const id = getRouterParam(event, "id")!;
  const query = parseQuery(event, peopleQuerySchema);
  const [org] = await db
    .select({ id: schema.organization.id })
    .from(schema.organization)
    .where(eq(schema.organization.id, id))
    .limit(1);

  if (!org) throw apiError(404, "ORGANIZATION_NOT_FOUND", "Organization not found");

  return listPeople(id, query);
});
