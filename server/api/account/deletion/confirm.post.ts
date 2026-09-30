import { z } from "zod";
import { confirmAccountDeletion } from "../../../lib/account-deletion";

export default defineEventHandler(async (event) => {
  const session = await requireSession(event);
  if ((session.session as { impersonatedBy?: string | null }).impersonatedBy) {
    throw apiError(403, "FORBIDDEN", "Not available while impersonating");
  }
  const { token } = await parseBody(event, z.object({ token: z.string().min(1).max(200) }));
  const result = await confirmAccountDeletion(session.user as { id: string; role?: string | null }, token);
  if (!result.ok) {
    if (result.code === "INVALID_TOKEN") throw apiError(400, result.code, "Invalid or expired link");
    if (result.code === "STAFF_ACCOUNT_MANAGED_IN_AUTHENTIK") throw apiError(403, result.code, "Staff accounts are managed in Authentik");
    throw apiError(400, result.code, `Transfer ownership first: ${result.organizations?.join(", ")}`, { organizations: result.organizations });
  }
  return { deleted: true };
});
