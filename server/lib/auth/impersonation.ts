import type { BetterAuthPlugin } from "better-auth";
import { getSessionFromCtx } from "better-auth/api";
import type { HookContext } from "./hook-context";
import { extendOAuthProvider } from "@better-auth/oauth-provider";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index";
import { IMPERSONATED_BY_CLAIM } from "./access-claims";

export async function impersonatorOf(sessionId: string | undefined): Promise<string | null> {
  if (!sessionId) return null;
  const [row] = await db
    .select({ impersonatedBy: schema.session.impersonatedBy })
    .from(schema.session)
    .where(eq(schema.session.id, sessionId))
    .limit(1);
  return row?.impersonatedBy ?? null;
}

export const impersonationClaim = () =>
  ({
    id: "impersonation-claim",
    init(ctx) {
      extendOAuthProvider(ctx, {
        claims: {
          accessToken: async ({ user, sessionId }) => {
            if (!user) return {};
            const admin = await impersonatorOf(sessionId);
            return admin ? { [IMPERSONATED_BY_CLAIM]: admin } : {};
          },
        },
      });
    },
  }) satisfies BetterAuthPlugin;

export async function stripOfflineAccessWhenImpersonating(ctx: HookContext) {
  if (ctx.path !== "/oauth2/authorize") return;
  const scope = typeof ctx.query?.scope === "string" ? ctx.query.scope : undefined;
  if (!scope?.split(" ").includes("offline_access")) return;
  const session = await getSessionFromCtx(ctx);
  if (!(session?.session as { impersonatedBy?: string | null } | undefined)?.impersonatedBy) return;
  return {
    context: {
      ...ctx,
      query: {
        ...ctx.query,
        scope: scope
          .split(" ")
          .filter((s) => s !== "offline_access")
          .join(" "),
      },
    },
  };
}
