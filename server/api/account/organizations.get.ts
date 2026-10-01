import { z } from "zod";
import { appByResource } from "../../lib/apps";
import { organizationsGrantingApp, userMemberships } from "../../lib/account-context";

export default defineEventHandler(async (event) => {
  const session = await requireSession(event);
  const { resource } = parseQuery(event, z.object({ resource: z.string().optional() }));

  if (!resource) return { organizations: await userMemberships(session.user.id) };

  const app = appByResource(resource);

  if (!app) throw apiError(400, "UNKNOWN_RESOURCE", "Unknown resource");

  return {
    app: { id: app.id, label: app.label },
    organizations: await organizationsGrantingApp(session.user.id, app.id),
  };
});
