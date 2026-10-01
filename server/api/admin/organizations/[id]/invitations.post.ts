import { invitationSchema, inviteToOrganization } from "../../../../lib/admin/organizations";

const FAILURES = {
  ORGANIZATION_NOT_FOUND: [404, "Organization not found"],
  UNKNOWN_ROLE: [400, "Role does not exist in this organization"],
  ALREADY_MEMBER: [409, "This person is already a member of the organization"],
} as const;

export default defineEventHandler(async (event) => {
  const session = await requireAdmin(event);
  const { email, role } = await parseBody(event, invitationSchema);
  const result = await inviteToOrganization(getRouterParam(event, "id")!, email, role, {
    ...actorOf(session),
    name: session.user.name || session.user.email,
  });

  if (!result.ok) {
    const [status, message] = FAILURES[result.code];

    throw apiError(status, result.code, message);
  }

  setResponseStatus(event, 201);

  return { invitationId: result.invitationId };
});
