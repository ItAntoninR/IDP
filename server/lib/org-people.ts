import { z } from "zod";
import { and, asc, count, eq, gt, ilike, not, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "./db/index";

export const peopleQuerySchema = z.object({
  q: z.string().trim().max(200).default(""),
  filter: z.enum(["all", "members", "pending", "no2fa"]).default("all"),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

export type PeopleQuery = z.infer<typeof peopleQuerySchema>;

export const likePattern = (q: string) => `%${q.replace(/[\\%_]/g, "\\$&")}%`;

const protectedUser = sql<boolean>`(coalesce(${schema.user.twoFactorEnabled}, false) or coalesce(${schema.user.hasPasskey}, false))`;

function memberWhere(organizationId: string, query: Pick<PeopleQuery, "q" | "filter">) {
  const filters: SQL[] = [eq(schema.member.organizationId, organizationId)];

  if (query.filter === "no2fa") filters.push(not(protectedUser));
  if (query.q) {
    filters.push(or(ilike(schema.user.name, likePattern(query.q)), ilike(schema.user.email, likePattern(query.q)))!);
  }

  return and(...filters);
}

function invitationWhere(organizationId: string, q: string) {
  const filters: SQL[] = [
    eq(schema.invitation.organizationId, organizationId),
    eq(schema.invitation.status, "pending"),
    gt(schema.invitation.expiresAt, new Date()),
  ];

  if (q) filters.push(ilike(schema.invitation.email, likePattern(q)));

  return and(...filters);
}

const countMembers = (where: SQL | undefined) =>
  db
    .select({ n: count() })
    .from(schema.member)
    .innerJoin(schema.user, eq(schema.user.id, schema.member.userId))
    .where(where)
    .then(([row]) => row?.n ?? 0);

const countInvitations = (where: SQL | undefined) =>
  db
    .select({ n: count() })
    .from(schema.invitation)
    .where(where)
    .then(([row]) => row?.n ?? 0);

export async function listPeople(organizationId: string, query: PeopleQuery) {
  const withMembers = query.filter !== "pending";
  const withInvitations = query.filter === "all" || query.filter === "pending";

  const [matchingMembers, matchingInvitations, members, pending, withoutTwoFactor] = await Promise.all([
    withMembers ? countMembers(memberWhere(organizationId, query)) : 0,
    withInvitations ? countInvitations(invitationWhere(organizationId, query.q)) : 0,
    countMembers(memberWhere(organizationId, { q: "", filter: "all" })),
    countInvitations(invitationWhere(organizationId, "")),
    countMembers(memberWhere(organizationId, { q: "", filter: "no2fa" })),
  ]);

  const memberLimit = Math.max(0, Math.min(query.limit, matchingMembers - query.offset));
  const invitationOffset = Math.max(0, query.offset - matchingMembers);
  const invitationLimit = query.limit - memberLimit;

  const [memberRows, invitationRows] = await Promise.all([
    memberLimit > 0
      ? db
          .select({
            id: schema.member.id,
            role: schema.member.role,
            createdAt: schema.member.createdAt,
            userId: schema.user.id,
            name: schema.user.name,
            email: schema.user.email,
            twoFactor: protectedUser,
          })
          .from(schema.member)
          .innerJoin(schema.user, eq(schema.user.id, schema.member.userId))
          .where(memberWhere(organizationId, query))
          .orderBy(asc(schema.member.createdAt), asc(schema.member.id))
          .limit(memberLimit)
          .offset(query.offset)
      : [],
    withInvitations && invitationLimit > 0 && invitationOffset < matchingInvitations
      ? db
          .select({
            id: schema.invitation.id,
            email: schema.invitation.email,
            role: schema.invitation.role,
            status: schema.invitation.status,
            expiresAt: schema.invitation.expiresAt,
            createdAt: schema.invitation.createdAt,
          })
          .from(schema.invitation)
          .where(invitationWhere(organizationId, query.q))
          .orderBy(asc(schema.invitation.createdAt), asc(schema.invitation.id))
          .limit(invitationLimit)
          .offset(invitationOffset)
      : [],
  ]);

  return {
    rows: [
      ...memberRows.map(({ userId, name, email, ...m }) => ({
        kind: "member" as const,
        ...m,
        userId,
        user: { id: userId, name, email },
      })),
      ...invitationRows.map((i) => ({ kind: "invitation" as const, ...i })),
    ],
    total: matchingMembers + matchingInvitations,
    counts: { members, pending, withoutTwoFactor },
  };
}
