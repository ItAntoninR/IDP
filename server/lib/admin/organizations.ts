import { z } from "zod";
import { and, count, desc, eq, gt, ilike, or, sql } from "drizzle-orm";
import { auth } from "../auth";
import { db, schema } from "../db/index";
import { APP_IDS } from "../../../shared/permissions";
import { INVITATION_TTL_SECONDS, sendInvitation } from "../auth/invitations";
import { audit } from "../support/audit";

export interface Actor {
  actorId: string;
  impersonatedBy: string | null;
  name: string;
}

const appsSchema = z.array(z.enum(APP_IDS as [string, ...string[]])).transform((a) => [...new Set(a)]);

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase letters, digits and dashes"),
  apps: appsSchema,
  ownerEmail: z.email().transform((e) => e.toLowerCase()),
});

export const updateOrganizationSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  apps: appsSchema.optional(),
  requireTwoFactor: z.boolean().optional(),
});

export const ownerInvitationSchema = z.object({
  email: z.email().transform((e) => e.toLowerCase()),
});

const generateId = async (model: string) => {
  const ctx = await auth.$context;
  return ctx.generateId({ model }) || crypto.randomUUID();
};

const invitationExpiry = (from: Date) => new Date(from.getTime() + INVITATION_TTL_SECONDS * 1000);

export async function listOrganizations(q: string) {
  const where = q ? or(ilike(schema.organization.name, `%${q}%`), ilike(schema.organization.slug, `%${q}%`)) : undefined;
  return db
    .select({
      id: schema.organization.id,
      name: schema.organization.name,
      slug: schema.organization.slug,
      apps: schema.organization.apps,
      createdAt: schema.organization.createdAt,
      memberCount: sql<number>`(select count(*)::int from "member" m where m.organization_id = "organization"."id")`,
      pendingInvitations: sql<number>`(select count(*)::int from "invitation" i where i.organization_id = "organization"."id" and i.status = 'pending' and i.expires_at > now())`,
    })
    .from(schema.organization)
    .where(where)
    .orderBy(desc(schema.organization.createdAt))
    .limit(200);
}

export async function getOrganizationDetail(id: string) {
  const [organization] = await db.select().from(schema.organization).where(eq(schema.organization.id, id)).limit(1);
  if (!organization) return null;
  const [[members], [pending]] = await Promise.all([
    db.select({ n: count() }).from(schema.member).where(eq(schema.member.organizationId, id)),
    db
      .select({ n: count() })
      .from(schema.invitation)
      .where(
        and(eq(schema.invitation.organizationId, id), eq(schema.invitation.status, "pending"), gt(schema.invitation.expiresAt, new Date())),
      ),
  ]);
  return { organization, counts: { members: members?.n ?? 0, pendingInvitations: pending?.n ?? 0 } };
}

export async function slugTaken(slug: string) {
  const [row] = await db.select({ n: count() }).from(schema.organization).where(eq(schema.organization.slug, slug));
  return (row?.n ?? 0) > 0;
}

export async function createOrganization(input: z.infer<typeof createOrganizationSchema>, actor: Actor) {
  const organizationId = await generateId("organization");
  const invitationId = await generateId("invitation");
  const now = new Date();

  const organization = await db.transaction(async (tx) => {
    const [org] = await tx
      .insert(schema.organization)
      .values({ id: organizationId, name: input.name, slug: input.slug, apps: input.apps, createdAt: now })
      .returning();
    await tx.insert(schema.invitation).values({
      id: invitationId,
      organizationId,
      email: input.ownerEmail,
      role: "owner",
      status: "pending",
      expiresAt: invitationExpiry(now),
      inviterId: actor.actorId,
      createdAt: now,
    });
    return org!;
  });

  sendInvitation({ invitationId, email: input.ownerEmail, organizationName: organization.name, inviterName: actor.name });

  await audit({
    ...actor,
    action: "organization.create",
    targetType: "organization",
    targetId: organization.id,
    organizationId: organization.id,
    metadata: { name: organization.name, slug: organization.slug, apps: organization.apps },
  });
  await audit({
    ...actor,
    action: "invitation.create",
    targetType: "invitation",
    targetId: invitationId,
    organizationId: organization.id,
    metadata: { email: input.ownerEmail, role: "owner" },
  });

  return { organization, invitationId };
}

export async function updateOrganization(id: string, input: z.infer<typeof updateOrganizationSchema>, actor: Actor) {
  const [before] = await db
    .select({ name: schema.organization.name, apps: schema.organization.apps, requireTwoFactor: schema.organization.requireTwoFactor })
    .from(schema.organization)
    .where(eq(schema.organization.id, id))
    .limit(1);
  if (!before) return null;

  const [organization] = await db
    .update(schema.organization)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.apps !== undefined ? { apps: input.apps } : {}),
      ...(input.requireTwoFactor !== undefined ? { requireTwoFactor: input.requireTwoFactor } : {}),
    })
    .where(eq(schema.organization.id, id))
    .returning();

  if (input.apps !== undefined) {
    await audit({
      ...actor,
      action: "organization.ceiling.update",
      targetType: "organization",
      targetId: id,
      organizationId: id,
      metadata: { from: before.apps ?? [], to: organization!.apps },
    });
  }
  if (input.requireTwoFactor !== undefined && input.requireTwoFactor !== (before.requireTwoFactor ?? false)) {
    await audit({
      ...actor,
      action: "organization.security.update",
      targetType: "organization",
      targetId: id,
      organizationId: id,
      metadata: { requireTwoFactor: input.requireTwoFactor },
    });
  }
  if (input.name !== undefined && input.name !== before.name) {
    await audit({
      ...actor,
      action: "organization.update",
      targetType: "organization",
      targetId: id,
      organizationId: id,
      metadata: { changes: { name: input.name } },
    });
  }
  return organization!;
}

export async function inviteOwner(id: string, email: string, actor: Actor) {
  const [org] = await db.select().from(schema.organization).where(eq(schema.organization.id, id)).limit(1);
  if (!org) return null;
  const invitationId = await generateId("invitation");
  const now = new Date();
  await db
    .update(schema.invitation)
    .set({ status: "canceled" })
    .where(
      and(eq(schema.invitation.organizationId, id), eq(schema.invitation.email, email), eq(schema.invitation.status, "pending")),
    );
  await db.insert(schema.invitation).values({
    id: invitationId,
    organizationId: id,
    email,
    role: "owner",
    status: "pending",
    expiresAt: invitationExpiry(now),
    inviterId: actor.actorId,
    createdAt: now,
  });
  sendInvitation({ invitationId, email, organizationName: org.name, inviterName: actor.name });
  await audit({
    ...actor,
    action: "invitation.create",
    targetType: "invitation",
    targetId: invitationId,
    organizationId: id,
    metadata: { email, role: "owner" },
  });
  return invitationId;
}
