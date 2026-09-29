import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const auditLog = pgTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id"),
    impersonatedBy: text("impersonated_by"),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    organizationId: text("organization_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
  },
  (t) => [
    index("audit_log_created_at_idx").on(t.createdAt),
    index("audit_log_actor_idx").on(t.actorId),
    index("audit_log_organization_idx").on(t.organizationId),
    index("audit_log_action_idx").on(t.action),
  ],
);
