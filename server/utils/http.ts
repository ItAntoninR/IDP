import type { H3Event } from "h3";
import type { z } from "zod";
import { auth } from "../lib/auth";
import { hasGlobalRole } from "../lib/support/roles";

export type AuthSession = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

export function apiError(status: number, code: string, message: string, issues?: unknown) {
  return createError({ statusCode: status, statusMessage: code, message, data: { code, issues } });
}

export async function getAuthSession(event: H3Event): Promise<AuthSession | null> {
  return auth.api.getSession({ headers: event.headers });
}

export async function requireSession(event: H3Event): Promise<AuthSession> {
  const session = await getAuthSession(event);

  if (!session) throw apiError(401, "UNAUTHORIZED", "Authentication required");

  return session;
}

export async function requireAdmin(event: H3Event): Promise<AuthSession> {
  const session = await requireSession(event);

  if (!hasGlobalRole(session.user.role, "admin")) throw apiError(403, "FORBIDDEN", "Admin role required");

  return session;
}

function validate<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
  const parsed = schema.safeParse(value);

  if (!parsed.success) {
    throw apiError(
      400,
      "VALIDATION_ERROR",
      "Invalid request",
      parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    );
  }

  return parsed.data;
}

export const parseBody = async <S extends z.ZodType>(event: H3Event, schema: S) =>
  validate(schema, await readBody(event).catch(() => undefined));

export const parseQuery = <S extends z.ZodType>(event: H3Event, schema: S) => validate(schema, getQuery(event));

export const actorOf = (session: AuthSession) => ({
  actorId: session.user.id,
  impersonatedBy: (session.session as { impersonatedBy?: string | null }).impersonatedBy ?? null,
});
