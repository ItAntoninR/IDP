import { transferOwnership, transferOwnershipSchema } from "../../../lib/org-ownership";

const FAILURES = {
  NOT_AN_OWNER: [403, "Only an owner can transfer ownership"],
  MEMBER_NOT_FOUND: [404, "Member not found in this organization"],
  ALREADY_OWNER: [409, "This member is already an owner"],
} as const;

export default defineEventHandler(async (event) => {
  const session = await requireSession(event);
  const organizationId = (session.session as { activeOrganizationId?: string | null }).activeOrganizationId;
  if (!organizationId) throw apiError(400, "NO_ACTIVE_ORGANIZATION", "No active organization");
  const { memberId } = await parseBody(event, transferOwnershipSchema);
  const result = await transferOwnership(organizationId, memberId, actorOf(session));
  if (!result.ok) {
    const [status, message] = FAILURES[result.code];
    throw apiError(status, result.code, message);
  }
  return { transferred: true };
});
