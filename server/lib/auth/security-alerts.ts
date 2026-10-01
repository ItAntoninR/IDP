import { createHash, randomUUID } from "node:crypto";
import { and, count, eq } from "drizzle-orm";
import { db, schema } from "../db/index";
import { env } from "../env";
import { sendEmailInBackground } from "../email/mailer";
import { securityAlertTemplate } from "../email/templates";
import type { HookContext } from "./hook-context";

export const DEVICE_COOKIE = "auth_device";
const DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 400;
const SECURITY_URL = `${env.AUTH_BASE_URL}/account/security`;
const SESSIONS_URL = `${env.AUTH_BASE_URL}/account/sessions`;

const SIGN_IN_METHODS: [test: (path: string) => boolean, label: string][] = [
  [(p) => p === "/sign-in/email", "Mot de passe"],
  [(p) => p.startsWith("/two-factor/verify-"), "Mot de passe et double authentification"],
  [(p) => p === "/passkey/verify-authentication", "Passkey"],
  [(p) => p.startsWith("/magic-link/verify"), "Lien par email"],
  [(p) => p === "/verify-email", "Confirmation de l'adresse email"],
  [(p) => p.startsWith("/callback/"), "Fournisseur externe"],
];
const PROVIDER_LABELS: Record<string, string> = { google: "Google", microsoft: "Microsoft", authentik: "Authentik" };

const hashDevice = (id: string) => createHash("sha256").update(id).digest("hex");

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeStyle: "short", timeZone: "Europe/Paris" }).format(date);

export function describeDevice(userAgent: string | null | undefined): string {
  if (!userAgent) return "Appareil inconnu";
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /OPR\//.test(userAgent)
      ? "Opera"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Chrome\//.test(userAgent)
          ? "Chrome"
          : /Safari\//.test(userAgent)
            ? "Safari"
            : "Navigateur";
  const os = /iPhone|iPad/.test(userAgent)
    ? "iOS"
    : /Android/.test(userAgent)
      ? "Android"
      : /Windows/.test(userAgent)
        ? "Windows"
        : /Mac OS X/.test(userAgent)
          ? "macOS"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "système inconnu";

  return `${browser} sur ${os}`;
}

function signInMethod(ctx: HookContext): string | null {
  const path = ctx.path ?? "";
  const match = SIGN_IN_METHODS.find(([test]) => test(path));

  if (!match) return null;
  if (path.startsWith("/callback/")) {
    const provider = ctx.params?.id ?? path.split("/").pop() ?? "";

    return PROVIDER_LABELS[provider] ?? match[1];
  }

  return match[1];
}

export function sendSecurityAlert(
  to: string,
  alert: { subject: string; title: string; intro: string; details?: [string, string][]; url?: string },
) {
  sendEmailInBackground(
    to,
    securityAlertTemplate({
      subject: alert.subject,
      title: alert.title,
      intro: alert.intro,
      details: [["Date", formatDate(new Date())], ...(alert.details ?? [])],
      url: alert.url ?? SECURITY_URL,
    }),
  );
}

export async function alertOnNewDevice(ctx: HookContext) {
  const created = ctx.context.newSession as
    | {
        session: {
          userId: string;
          userAgent?: string | null;
          ipAddress?: string | null;
          impersonatedBy?: string | null;
        };
        user: { email: string };
      }
    | null
    | undefined;

  if (!created || created.session.impersonatedBy) return;
  const method = signInMethod(ctx);

  if (!method) return;

  let deviceId = ctx.getCookie(DEVICE_COOKIE);

  if (!deviceId) {
    deviceId = randomUUID();
    ctx.setCookie(DEVICE_COOKIE, deviceId, {
      httpOnly: true,
      secure: env.AUTH_BASE_URL.startsWith("https://"),
      sameSite: "lax",
      path: "/",
      maxAge: DEVICE_COOKIE_MAX_AGE,
    });
  }

  const userId = created.session.userId;
  const deviceHash = hashDevice(deviceId);
  const [[known], [devices]] = await Promise.all([
    db
      .select({ id: schema.knownDevice.id })
      .from(schema.knownDevice)
      .where(and(eq(schema.knownDevice.userId, userId), eq(schema.knownDevice.deviceHash, deviceHash)))
      .limit(1),
    db.select({ n: count() }).from(schema.knownDevice).where(eq(schema.knownDevice.userId, userId)),
  ]);

  if (known) {
    await db.update(schema.knownDevice).set({ lastSeenAt: new Date() }).where(eq(schema.knownDevice.id, known.id));

    return;
  }

  await db
    .insert(schema.knownDevice)
    .values({ id: randomUUID(), userId, deviceHash, userAgent: created.session.userAgent ?? null })
    .onConflictDoNothing();
  if (!devices?.n) return;

  sendSecurityAlert(created.user.email, {
    subject: "Nouvelle connexion à votre compte",
    title: "Nouvelle connexion à votre compte",
    intro: "Votre compte vient d'être utilisé depuis un appareil sur lequel vous ne vous étiez jamais connecté.",
    details: [
      ["Appareil", describeDevice(created.session.userAgent)],
      ["Adresse IP", created.session.ipAddress || "inconnue"],
      ["Méthode", method],
    ],
    url: SESSIONS_URL,
  });
}

export async function alertOnPasswordChange(ctx: HookContext) {
  if (ctx.path !== "/change-password" || ctx.context.returned instanceof Error) return;
  const session = ctx.context.session as { user?: { email: string } } | null | undefined;
  const email = session?.user?.email;

  if (!email) return;
  notifyPasswordChanged(email);
}

export function notifyPasswordChanged(email: string) {
  sendSecurityAlert(email, {
    subject: "Votre mot de passe a été modifié",
    title: "Votre mot de passe a été modifié",
    intro: "Le mot de passe de votre compte vient d'être modifié.",
  });
}

export function twoFactorChange(user: { twoFactorEnabled?: boolean | null }, path: string | undefined) {
  if (path === "/two-factor/disable") return "disabled" as const;
  if (path?.startsWith("/two-factor/") && user.twoFactorEnabled) return "enabled" as const;

  return null;
}

export function alertOnTwoFactorChange(
  user: { email: string; twoFactorEnabled?: boolean | null },
  path: string | undefined,
) {
  const change = twoFactorChange(user, path);

  if (change === "disabled") {
    sendSecurityAlert(user.email, {
      subject: "Double authentification désactivée",
      title: "La double authentification est désactivée",
      intro:
        "L'application d'authentification a été retirée de votre compte : un code n'est plus demandé à la connexion.",
    });
  } else if (change === "enabled") {
    sendSecurityAlert(user.email, {
      subject: "Double authentification activée",
      title: "La double authentification est activée",
      intro: "Une application d'authentification protège désormais votre compte.",
    });
  }
}

export function alertOnPasskeyChange(email: string, change: "added" | "removed", name?: string | null) {
  sendSecurityAlert(email, {
    subject: change === "added" ? "Nouvelle passkey ajoutée" : "Passkey supprimée",
    title: change === "added" ? "Une passkey a été ajoutée" : "Une passkey a été supprimée",
    intro:
      change === "added"
        ? "Une nouvelle passkey peut désormais être utilisée pour vous connecter."
        : "Une passkey ne peut plus être utilisée pour vous connecter.",
    details: name ? [["Passkey", name]] : [],
  });
}
