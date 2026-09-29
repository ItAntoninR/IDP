import { z } from "zod";
import { listOrganizations } from "../../../lib/admin/organizations";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const { q } = parseQuery(event, z.object({ q: z.string().trim().default("") }));
  return { organizations: await listOrganizations(q) };
});
