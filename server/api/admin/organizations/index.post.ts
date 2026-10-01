import { createOrganization, createOrganizationSchema, slugTaken } from "../../../lib/admin/organizations";

export default defineEventHandler(async (event) => {
  const session = await requireAdmin(event);
  const input = await parseBody(event, createOrganizationSchema);

  if (await slugTaken(input.slug)) throw apiError(400, "SLUG_TAKEN", "Slug already in use");
  const result = await createOrganization(input, {
    ...actorOf(session),
    name: session.user.name || session.user.email,
  });

  setResponseStatus(event, 201);

  return result;
});
