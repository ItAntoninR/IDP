import { deleteUserAsAdmin } from "../../../lib/account-deletion";

export default defineEventHandler(async (event) => {
  const session = await requireAdmin(event);
  const result = await deleteUserAsAdmin(getRouterParam(event, "id")!, actorOf(session));

  if (!result.ok) {
    if (result.code === "USER_NOT_FOUND") throw apiError(404, result.code, "User not found");
    if (result.code === "STAFF_ACCOUNT_MANAGED_IN_AUTHENTIK") {
      throw apiError(403, result.code, "Staff accounts are managed in Authentik");
    }

    if (result.code === "SOLE_OWNER") {
      throw apiError(409, result.code, `Transfer ownership first: ${result.organizations?.join(", ")}`, {
        organizations: result.organizations,
      });
    }

    throw apiError(400, result.code, "You cannot delete your own account here");
  }

  return { deleted: true };
});
