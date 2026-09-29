import { z } from "zod";
import { and, count, desc, eq, gte, lte, type SQL } from "drizzle-orm";
import { db, schema } from "../db/index";
import { AUDIT_ACTIONS } from "../support/audit";

export const auditQuerySchema = z.object({
  action: z.enum(AUDIT_ACTIONS).optional(),
  actorId: z.string().optional(),
  targetId: z.string().optional(),
  organizationId: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function queryAuditLog(q: z.infer<typeof auditQuerySchema>) {
  const filters: SQL[] = [];
  if (q.action) filters.push(eq(schema.auditLog.action, q.action));
  if (q.actorId) filters.push(eq(schema.auditLog.actorId, q.actorId));
  if (q.targetId) filters.push(eq(schema.auditLog.targetId, q.targetId));
  if (q.organizationId) filters.push(eq(schema.auditLog.organizationId, q.organizationId));
  if (q.from) filters.push(gte(schema.auditLog.createdAt, q.from));
  if (q.to) filters.push(lte(schema.auditLog.createdAt, q.to));
  const where = filters.length ? and(...filters) : undefined;

  const rows = await db
    .select({
      entry: schema.auditLog,
      actorEmail: schema.user.email,
      actorName: schema.user.name,
      organizationName: schema.organization.name,
    })
    .from(schema.auditLog)
    .leftJoin(schema.user, eq(schema.user.id, schema.auditLog.actorId))
    .leftJoin(schema.organization, eq(schema.organization.id, schema.auditLog.organizationId))
    .where(where)
    .orderBy(desc(schema.auditLog.createdAt))
    .limit(q.limit)
    .offset(q.offset);
  const [total] = await db.select({ n: count() }).from(schema.auditLog).where(where);

  return {
    entries: rows.map((r) => ({
      ...r.entry,
      actorEmail: r.actorEmail,
      actorName: r.actorName,
      organizationName: r.organizationName,
    })),
    total: total?.n ?? 0,
  };
}
