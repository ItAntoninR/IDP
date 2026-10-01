import { pairingOrganizations } from "../../../lib/connectors/eligibility";

export default defineEventHandler(async (event) => {
  const session = await requireSession(event);

  return { organizations: await pairingOrganizations(event.headers, session.user.id) };
});
