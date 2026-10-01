import { accountContext } from "../../lib/account-context";

export default defineEventHandler(async (event) => {
  const session = await requireSession(event);
  const s = session.session as { activeOrganizationId?: string | null; impersonatedBy?: string | null };

  return accountContext(event.headers, session.user.id, s.activeOrganizationId ?? null, !!s.impersonatedBy);
});
