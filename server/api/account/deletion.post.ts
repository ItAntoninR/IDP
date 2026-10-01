import { requestAccountDeletion } from "../../lib/account-deletion";

export default defineEventHandler(async (event) => {
  const session = await requireSession(event);

  if ((session.session as { impersonatedBy?: string | null }).impersonatedBy) {
    throw apiError(403, "FORBIDDEN", "Not available while impersonating");
  }

  const result = await requestAccountDeletion(session.user as { id: string; email: string; role?: string | null });

  if (!result.ok) {
    if (result.code === "STAFF_ACCOUNT_MANAGED_IN_AUTHENTIK") {
      throw apiError(403, result.code, "Staff accounts are managed in Authentik");
    }

    throw apiError(400, result.code, `Transfer ownership first: ${result.organizations?.join(", ")}`, {
      organizations: result.organizations,
    });
  }

  return { sent: true };
});
