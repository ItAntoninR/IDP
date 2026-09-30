import { index, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

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

export const knownDevice = pgTable(
  "known_device",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    deviceHash: text("device_hash").notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("known_device_user_hash_idx").on(t.userId, t.deviceHash)],
);
