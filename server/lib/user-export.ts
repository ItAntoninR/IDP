import { and, desc, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import { db, schema } from "./db/index";
import { sendSecurityAlert } from "./auth/security-alerts";
import { audit } from "./support/audit";

const NOTICE =
  "Copie des données personnelles détenues par le service d'authentification, fournie au titre du droit d'accès (article 15 du RGPD). Les secrets de connexion (mot de passe, codes de double authentification, clés, jetons) ne sont jamais exportés. Les données des applications sont exportées séparément par chacune d'elles.";

export async function collectUserData(userId: string) {
  const [user] = await db
    .select({
      id: schema.user.id,
      name: schema.user.name,
      email: schema.user.email,
      emailVerified: schema.user.emailVerified,
      role: schema.user.role,
      banned: schema.user.banned,
      banReason: schema.user.banReason,
      banExpires: schema.user.banExpires,
      twoFactorEnabled: schema.user.twoFactorEnabled,
      createdAt: schema.user.createdAt,
      updatedAt: schema.user.updatedAt,
    })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1);

  if (!user) return null;

  const [accounts, passkeys, devices, sessions, memberships, received, sent, consents] = await Promise.all([
    db
      .select({
        providerId: schema.account.providerId,
        hasPassword: isNotNull(schema.account.password),
        createdAt: schema.account.createdAt,
      })
      .from(schema.account)
      .where(eq(schema.account.userId, userId)),
    db
      .select({
        name: schema.passkey.name,
        deviceType: schema.passkey.deviceType,
        backedUp: schema.passkey.backedUp,
        createdAt: schema.passkey.createdAt,
      })
      .from(schema.passkey)
      .where(eq(schema.passkey.userId, userId)),
    db
      .select({
        userAgent: schema.knownDevice.userAgent,
        firstSeenAt: schema.knownDevice.createdAt,
        lastSeenAt: schema.knownDevice.lastSeenAt,
      })
      .from(schema.knownDevice)
      .where(eq(schema.knownDevice.userId, userId))
      .orderBy(desc(schema.knownDevice.lastSeenAt)),
    db
      .select({
        createdAt: schema.session.createdAt,
        expiresAt: schema.session.expiresAt,
        ipAddress: schema.session.ipAddress,
        userAgent: schema.session.userAgent,
        impersonatedBy: schema.session.impersonatedBy,
      })
      .from(schema.session)
      .where(eq(schema.session.userId, userId))
      .orderBy(desc(schema.session.createdAt)),
    db
      .select({
        memberId: schema.member.id,
        organizationId: schema.organization.id,
        organization: schema.organization.name,
        role: schema.member.role,
        since: schema.member.createdAt,
      })
      .from(schema.member)
      .innerJoin(schema.organization, eq(schema.organization.id, schema.member.organizationId))
      .where(eq(schema.member.userId, userId)),
    db
      .select({
        organization: schema.organization.name,
        role: schema.invitation.role,
        status: schema.invitation.status,
        createdAt: schema.invitation.createdAt,
        expiresAt: schema.invitation.expiresAt,
      })
      .from(schema.invitation)
      .innerJoin(schema.organization, eq(schema.organization.id, schema.invitation.organizationId))
      .where(eq(sql`lower(${schema.invitation.email})`, user.email.toLowerCase())),
    db
      .select({
        organization: schema.organization.name,
        email: schema.invitation.email,
        role: schema.invitation.role,
        status: schema.invitation.status,
        createdAt: schema.invitation.createdAt,
      })
      .from(schema.invitation)
      .innerJoin(schema.organization, eq(schema.organization.id, schema.invitation.organizationId))
      .where(eq(schema.invitation.inviterId, userId)),
    db
      .select({
        application: schema.oauthClient.name,
        scopes: schema.oauthConsent.scopes,
        organizationId: schema.oauthConsent.referenceId,
        grantedAt: schema.oauthConsent.createdAt,
        updatedAt: schema.oauthConsent.updatedAt,
      })
      .from(schema.oauthConsent)
      .leftJoin(schema.oauthClient, eq(schema.oauthClient.clientId, schema.oauthConsent.clientId))
      .where(eq(schema.oauthConsent.userId, userId)),
  ]);

  const memberIds = memberships.map((m) => m.memberId);
  const activity = await db
    .select({
      date: schema.auditLog.createdAt,
      action: schema.auditLog.action,
      byUser: sql<boolean>`${schema.auditLog.actorId} = ${userId}`,
      impersonated: isNotNull(schema.auditLog.impersonatedBy),
      organization: schema.organization.name,
      targetType: schema.auditLog.targetType,
      metadata: schema.auditLog.metadata,
    })
    .from(schema.auditLog)
    .leftJoin(schema.organization, eq(schema.organization.id, schema.auditLog.organizationId))
    .where(
      or(
        eq(schema.auditLog.actorId, userId),
        and(eq(schema.auditLog.targetType, "user"), eq(schema.auditLog.targetId, userId)),
        memberIds.length
          ? and(eq(schema.auditLog.targetType, "member"), inArray(schema.auditLog.targetId, memberIds))
          : undefined,
        sql`${schema.auditLog.metadata}->>'userId' = ${userId}`,
      ),
    )
    .orderBy(desc(schema.auditLog.createdAt));

  return {
    exportedAt: new Date().toISOString(),
    notice: NOTICE,
    profile: user,
    signInMethods: {
      password: accounts.some((a) => a.providerId === "credential" && a.hasPassword),
      linkedAccounts: accounts
        .filter((a) => a.providerId !== "credential")
        .map((a) => ({ provider: a.providerId, linkedAt: a.createdAt })),
    },
    security: { twoFactorEnabled: user.twoFactorEnabled === true, passkeys, knownDevices: devices },
    sessions: sessions.map(({ impersonatedBy, ...s }) => ({ ...s, openedBySupport: !!impersonatedBy })),
    organizations: memberships.map(({ memberId: _memberId, ...m }) => m),
    invitations: { received, sent },
    authorizedApplications: consents,
    activity: activity.map(({ impersonated, ...entry }) => ({ ...entry, bySupport: impersonated })),
  };
}

export async function exportUserData(userId: string, actor: { actorId: string; impersonatedBy: string | null }) {
  const data = await collectUserData(userId);

  if (!data) return null;
  await audit({ ...actor, action: "user.export", targetType: "user", targetId: userId });
  sendSecurityAlert(data.profile.email, {
    subject: "Une copie de vos données a été exportée",
    title: "Une copie de vos données a été exportée",
    intro:
      "Notre équipe a exporté une copie des données de votre compte, à la suite d'une demande d'accès à vos données. Si vous n'avez fait aucune demande, contactez-nous.",
  });

  return data;
}
