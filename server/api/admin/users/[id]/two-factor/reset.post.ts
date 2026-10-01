import { resetTwoFactor } from "../../../../../lib/admin/two-factor-reset";

export default defineEventHandler(async (event) => {
  const session = await requireAdmin(event);
  const result = await resetTwoFactor(getRouterParam(event, "id")!, actorOf(session));

  if (result.status === "not_found") throw apiError(404, "USER_NOT_FOUND", "User not found");
  if (result.status === "staff") {
    throw apiError(400, "STAFF_MANAGED_BY_AUTHENTIK", "Staff second factors are managed in Authentik");
  }

  return { ok: true };
});
