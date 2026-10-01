import { APIError, getSessionFromCtx } from "better-auth/api";
import { hasGlobalRole } from "../support/roles";
import type { HookContext } from "./hook-context";

const DOC_PATHS = ["/reference", "/open-api/generate-schema"];

export async function restrictApiDocsToAdmins(ctx: HookContext) {
  if (!ctx.path || !DOC_PATHS.includes(ctx.path)) return;
  const session = await getSessionFromCtx(ctx);

  if (!session || !hasGlobalRole(session.user.role, "admin")) throw new APIError("NOT_FOUND");
}
