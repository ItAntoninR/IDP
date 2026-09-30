import { APIError } from "better-auth/api";
import { sql } from "drizzle-orm";
import { schema } from "./db/index";
import type { HookContext } from "./auth/hook-context";

export const LOGO_MAX_LENGTH = 200_000;
const LOGO_PATTERN = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/;
const MANAGER_FIELDS = new Set(["name", "logo", "requireTwoFactor"]);

export const logoVersion = sql<string | null>`case when coalesce(${schema.organization.logo}, '') = '' then null else left(md5(${schema.organization.logo}), 12) end`;

export const logoUrl = (organizationId: string, version: string | null | undefined) =>
  version ? `/api/public/organizations/${encodeURIComponent(organizationId)}/logo?v=${version}` : null;

export function parseLogo(logo: string | null | undefined): { type: string; data: Buffer } | null {
  const match = logo ? LOGO_PATTERN.exec(logo) : null;
  return match ? { type: match[1]!, data: Buffer.from(match[2]!, "base64") } : null;
}

const fail = (code: string, message: string) => new APIError("BAD_REQUEST", { code, message });

export function validateOrganizationProfile(ctx: HookContext) {
  if (ctx.path !== "/organization/update") return;
  const data = (ctx.body as { data?: Record<string, unknown> } | undefined)?.data ?? {};

  const extra = Object.keys(data).filter((key) => key !== "apps" && !MANAGER_FIELDS.has(key));
  if (extra.length) {
    throw new APIError("FORBIDDEN", { code: "ORGANIZATION_FIELD_ADMIN_ONLY", message: `Only global admins can change: ${extra.join(", ")}` });
  }
  if ("name" in data) {
    const name = typeof data.name === "string" ? data.name.trim() : "";
    if (!name || name.length > 120) throw fail("INVALID_ORGANIZATION_NAME", "Name must be 1 to 120 characters");
    data.name = name;
  }
  if ("logo" in data && data.logo !== null && data.logo !== "") {
    if (typeof data.logo !== "string" || !parseLogo(data.logo)) throw fail("INVALID_LOGO", "Logo must be a PNG, JPEG or WebP data URL");
    if (data.logo.length > LOGO_MAX_LENGTH) throw fail("LOGO_TOO_LARGE", "Logo is too large");
  }
}
