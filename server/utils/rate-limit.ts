import { randomUUID } from "node:crypto";
import type { H3Event } from "h3";
import { sql } from "drizzle-orm";
import { db, schema } from "../lib/db/index";
import { env } from "../lib/env";

export interface RateLimitRule {
  windowSeconds: number;
  max: number;
}

function clientAddress(event: H3Event) {
  const forwarded = getRequestHeader(event, env.TRUSTED_IP_HEADER)?.split(",")[0]?.trim();

  return forwarded || event.node.req.socket.remoteAddress || "unknown";
}

async function hit(key: string, rule: RateLimitRule) {
  const now = Date.now();
  const windowStart = now - rule.windowSeconds * 1000;
  const [row] = await db
    .insert(schema.rateLimit)
    .values({ id: randomUUID(), key, count: 1, lastRequest: now })
    .onConflictDoUpdate({
      target: schema.rateLimit.key,
      set: {
        count: sql`case when ${schema.rateLimit.lastRequest} < ${windowStart} then 1 else ${schema.rateLimit.count} + 1 end`,
        lastRequest: sql`case when ${schema.rateLimit.lastRequest} < ${windowStart} then ${now} else ${schema.rateLimit.lastRequest} end`,
      },
    })
    .returning({ count: schema.rateLimit.count, lastRequest: schema.rateLimit.lastRequest });

  return { count: row?.count ?? 1, resetAt: (row?.lastRequest ?? now) + rule.windowSeconds * 1000 };
}

export async function enforceRateLimit(event: H3Event, bucket: string, rule: RateLimitRule, subject?: string) {
  if (!env.RATE_LIMIT_ENABLED) return;
  const { count, resetAt } = await hit(`${bucket}:${subject ?? clientAddress(event)}`, rule);

  if (count > rule.max) {
    setResponseHeader(event, "retry-after", Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)));
    throw apiError(429, "TOO_MANY_REQUESTS", "Too many requests");
  }
}
