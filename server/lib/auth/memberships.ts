import { count, eq } from "drizzle-orm";
import { db, schema } from "../db/index";

export async function countMemberships(userId: string): Promise<number> {
  const [row] = await db.select({ n: count() }).from(schema.member).where(eq(schema.member.userId, userId));
  return row?.n ?? 0;
}
