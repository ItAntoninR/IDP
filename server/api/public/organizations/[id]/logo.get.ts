import { eq } from "drizzle-orm";
import { db, schema } from "../../../../lib/db/index";
import { parseLogo } from "../../../../lib/org-profile";

export default defineEventHandler(async (event) => {
  const [org] = await db
    .select({ logo: schema.organization.logo })
    .from(schema.organization)
    .where(eq(schema.organization.id, getRouterParam(event, "id")!))
    .limit(1);
  const logo = parseLogo(org?.logo);
  if (!logo) throw apiError(404, "NOT_FOUND", "No logo");

  setResponseHeaders(event, {
    "content-type": logo.type,
    "cache-control": getQuery(event).v ? "public, max-age=31536000, immutable" : "no-cache",
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'none'",
  });
  return logo.data;
});
