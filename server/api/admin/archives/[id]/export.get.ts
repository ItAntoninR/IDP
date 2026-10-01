import { exportArchive } from "../../../../lib/admin/archives";

export default defineEventHandler(async (event) => {
  const session = await requireAdmin(event);
  const data = await exportArchive(getRouterParam(event, "id")!, actorOf(session));

  if (!data) throw apiError(404, "NOT_FOUND", "Archive not found");
  setResponseHeaders(event, {
    "content-type": "application/json; charset=utf-8",
    "content-disposition": `attachment; filename="archive-${data.userId}-${data.exportedAt.slice(0, 10)}.json"`,
    "cache-control": "no-store",
  });

  return JSON.stringify(data, null, 2);
});
