import { archiveSearchSchema, searchArchives } from "../../../lib/admin/archives";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const { email } = parseQuery(event, archiveSearchSchema);
  return { archives: await searchArchives(email) };
});
