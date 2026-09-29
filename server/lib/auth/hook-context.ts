import type { createAuthMiddleware } from "better-auth/api";

type Handler = Parameters<typeof createAuthMiddleware>[0];
export type HookContext = Parameters<Extract<Handler, (ctx: never) => unknown>>[0];
