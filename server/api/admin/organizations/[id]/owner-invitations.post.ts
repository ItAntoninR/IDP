import { inviteOwner, ownerInvitationSchema } from "../../../../lib/admin/organizations";

export default defineEventHandler(async (event) => {
  const session = await requireAdmin(event);
  const { email } = await parseBody(event, ownerInvitationSchema);
  const invitationId = await inviteOwner(getRouterParam(event, "id")!, email, {
    ...actorOf(session),
    name: session.user.name || session.user.email,
  });
  if (!invitationId) throw apiError(404, "ORGANIZATION_NOT_FOUND", "Organization not found");
  setResponseStatus(event, 201);
  return { invitationId };
});
