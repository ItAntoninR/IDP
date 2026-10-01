import { deletionBlocker } from "../../lib/account-deletion";

export default defineEventHandler(async (event) => {
  const session = await requireSession(event);

  return { blocker: await deletionBlocker(session.user as { id: string; role?: string | null }) };
});
