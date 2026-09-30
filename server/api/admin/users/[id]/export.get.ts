import { exportUserData } from "../../../../lib/user-export";

export default defineEventHandler(async (event) => {
  const session = await requireAdmin(event);
  const userId = getRouterParam(event, "id")!;
  const data = await exportUserData(userId, actorOf(session));
  if (!data) throw apiError(404, "USER_NOT_FOUND", "User not found");

  const date = data.exportedAt.slice(0, 10);
  setResponseHeaders(event, {
    "content-type": "application/json; charset=utf-8",
    "content-disposition": `attachment; filename="donnees-${userId}-${date}.json"`,
    "cache-control": "no-store",
  });
  return JSON.stringify(data, null, 2);
});
