import { APIError } from "better-auth/api";
import type { HookContext } from "../auth/hook-context";

export function requireResourceForMachineTokens(ctx: HookContext) {
  if (ctx.path !== "/oauth2/token") return;
  const body = (ctx.body ?? {}) as { grant_type?: unknown; resource?: unknown };

  if (body.grant_type !== "client_credentials") return;
  const resources = [body.resource].flat().filter((r) => typeof r === "string" && r.length > 0);

  if (resources.length !== 1) {
    throw new APIError("BAD_REQUEST", {
      error: "invalid_target",
      error_description: "Exactly one resource must be requested",
    });
  }
}
