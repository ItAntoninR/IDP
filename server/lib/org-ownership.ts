import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "./db/index";
import { audit } from "./support/audit";

const OWNER = "owner";

export const roleList = (role: string) =>
  role
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);

const isOwnerRole = (role: string) => roleList(role).includes(OWNER);

export async function soleOwnedOrganizations(userId: string) {
  return db
    .select({ id: schema.organization.id, name: schema.organization.name })
    .from(schema.member)
    .innerJoin(schema.organization, eq(schema.organization.id, schema.member.organizationId))
    .where(
      and(
        eq(schema.member.userId, userId),
        sql`${OWNER} = any(string_to_array(${schema.member.role}, ','))`,
        sql`not exists (
          select 1 from ${schema.member} other
          where other.organization_id = ${schema.member.organizationId}
            and other.user_id <> ${userId}
            and ${OWNER} = any(string_to_array(other.role, ','))
        )`,
      ),
    )
    .orderBy(schema.organization.name);
}

export const transferOwnershipSchema = z.object({ memberId: z.string().min(1) });

type TransferResult = { ok: true } | { ok: false; code: "NOT_AN_OWNER" | "MEMBER_NOT_FOUND" | "ALREADY_OWNER" };

export async function transferOwnership(
  organizationId: string,
  memberId: string,
  actor: { actorId: string; impersonatedBy: string | null },
): Promise<TransferResult> {
  const result = await db.transaction(async (tx): Promise<TransferResult & { toUserId?: string }> => {
    const [from] = await tx
      .select({ id: schema.member.id, role: schema.member.role })
      .from(schema.member)
      .where(and(eq(schema.member.organizationId, organizationId), eq(schema.member.userId, actor.actorId)))
      .for("update")
      .limit(1);

    if (!from || !isOwnerRole(from.role)) return { ok: false, code: "NOT_AN_OWNER" };

    const [to] = await tx
      .select({ id: schema.member.id, role: schema.member.role, userId: schema.member.userId })
      .from(schema.member)
      .where(and(eq(schema.member.organizationId, organizationId), eq(schema.member.id, memberId)))
      .for("update")
      .limit(1);

    if (!to || to.id === from.id) return { ok: false, code: "MEMBER_NOT_FOUND" };
    if (isOwnerRole(to.role)) return { ok: false, code: "ALREADY_OWNER" };

    const remaining = roleList(from.role).filter((r) => r !== OWNER);

    await tx.update(schema.member).set({ role: OWNER }).where(eq(schema.member.id, to.id));
    await tx
      .update(schema.member)
      .set({ role: remaining.length ? remaining.join(",") : "member" })
      .where(eq(schema.member.id, from.id));

    return { ok: true, toUserId: to.userId };
  });

  if (result.ok) {
    await audit({
      ...actor,
      action: "organization.owner.transfer",
      targetType: "member",
      targetId: memberId,
      organizationId,
      metadata: { toUserId: result.toUserId },
    });
  }

  return result.ok ? { ok: true } : result;
}
