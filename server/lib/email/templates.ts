export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(title: string, body: string, cta: { label: string; url: string } | null, footer: string) {
  const button = cta
    ? `<p style="margin:0 0 24px"><a href="${escape(cta.url)}" style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">${escape(cta.label)}</a></p>`
    : "";
  const fallback = cta
    ? `<br>Si le bouton ne fonctionne pas, copiez ce lien :<br><span style="word-break:break-all">${escape(cta.url)}</span>`
    : "";

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>${escape(title)}</title></head>
<body style="margin:0;background:#f4f4f5;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#18181b">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:12px;padding:32px">
      <tr><td>
        <h1 style="font-size:20px;margin:0 0 16px">${escape(title)}</h1>
        <p style="font-size:15px;line-height:1.6;margin:0 0 24px">${body}</p>
        ${button}
        <p style="font-size:13px;color:#71717a;line-height:1.5;margin:0">${escape(footer)}${fallback}</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

export function verifyEmailTemplate(url: string): EmailContent {
  return {
    subject: "Confirmez votre adresse email",
    html: layout(
      "Confirmez votre adresse email",
      "Cliquez sur le bouton ci-dessous pour confirmer votre adresse email.",
      { label: "Confirmer mon email", url },
      "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.",
    ),
    text: `Confirmez votre adresse email : ${url}`,
  };
}

export function resetPasswordTemplate(url: string): EmailContent {
  return {
    subject: "Réinitialisation de votre mot de passe",
    html: layout(
      "Réinitialisez votre mot de passe",
      "Vous avez demandé à réinitialiser votre mot de passe. Ce lien est valable 1 heure.",
      { label: "Choisir un nouveau mot de passe", url },
      "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email : votre mot de passe reste inchangé.",
    ),
    text: `Réinitialisez votre mot de passe : ${url}`,
  };
}

export function magicLinkTemplate(url: string): EmailContent {
  return {
    subject: "Votre lien de connexion",
    html: layout(
      "Votre lien de connexion",
      "Cliquez sur le bouton ci-dessous pour vous connecter. Ce lien est valable 5 minutes et ne peut servir qu'une fois.",
      { label: "Me connecter", url },
      "Si vous n'avez pas demandé ce lien, ignorez cet email.",
    ),
    text: `Connectez-vous : ${url}`,
  };
}

export function invitationTemplate(params: {
  url: string;
  organizationName: string;
  inviterName: string;
}): EmailContent {
  const org = escape(params.organizationName);
  const inviter = escape(params.inviterName);

  return {
    subject: `Invitation à rejoindre ${params.organizationName}`,
    html: layout(
      `Rejoignez ${params.organizationName}`,
      `<strong>${inviter}</strong> vous invite à rejoindre l'organisation <strong>${org}</strong>. Cette invitation est valable 7 jours.`,
      { label: "Accepter l'invitation", url: params.url },
      "Si vous ne vous attendiez pas à cette invitation, ignorez cet email.",
    ),
    text: `${params.inviterName} vous invite à rejoindre ${params.organizationName} : ${params.url}`,
  };
}

export function deleteAccountTemplate(url: string): EmailContent {
  return {
    subject: "Confirmez la suppression de votre compte",
    html: layout(
      "Confirmez la suppression de votre compte",
      "Vous avez demandé la suppression de votre compte. Elle est <strong>définitive</strong> : vos accès aux applications et vos informations personnelles seront effacés. Seules votre identité et votre historique de connexion sont conservés 1 an dans une archive, pour répondre à une éventuelle demande des autorités. Ce lien est valable 1 heure.",
      { label: "Supprimer mon compte", url },
      "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email et changez votre mot de passe.",
    ),
    text: `Confirmez la suppression définitive de votre compte (lien valable 1 heure) : ${url}\n\nVos accès aux applications et vos informations personnelles seront effacés. Seules votre identité et votre historique de connexion sont conservés 1 an dans une archive, pour répondre à une éventuelle demande des autorités.`,
  };
}

const DELETION_REASONS = {
  self: "Votre compte a bien été supprimé.",
  admin: "Votre compte a été supprimé par notre équipe, à votre demande.",
  inactivity: "Votre compte a été supprimé car il n'avait pas été utilisé depuis 3 ans.",
} as const;

export function accountDeletedTemplate(reason: keyof typeof DELETION_REASONS): EmailContent {
  const intro = `${DELETION_REASONS[reason]} Vos accès aux applications et vos informations personnelles ont été effacés. Votre identité et votre historique de connexion sont conservés 1 an dans une archive, uniquement pour répondre à une éventuelle demande des autorités, puis effacés.`;

  return {
    subject: "Votre compte a été supprimé",
    html: layout(
      "Votre compte a été supprimé",
      escape(intro),
      null,
      "Pour utiliser à nouveau nos applications, il vous faudra une nouvelle invitation.",
    ),
    text: intro,
  };
}

export function inactivityWarningTemplate(url: string, deletionDate: Date): EmailContent {
  const date = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" }).format(deletionDate);
  const intro = `Vous ne vous êtes pas connecté à votre compte depuis bientôt 3 ans. Sans connexion de votre part, il sera supprimé le ${date}.`;

  return {
    subject: "Votre compte sera bientôt supprimé",
    html: layout(
      "Votre compte sera bientôt supprimé",
      `${escape(intro)} Pour le conserver, il suffit de vous connecter une fois avant cette date.`,
      { label: "Me connecter", url },
      "Si vous n'utilisez plus nos applications, vous n'avez rien à faire.",
    ),
    text: `${intro} Pour le conserver, connectez-vous avant cette date : ${url}`,
  };
}

export function securityAlertTemplate(params: {
  subject: string;
  title: string;
  intro: string;
  details: [label: string, value: string][];
  url: string;
}): EmailContent {
  const rows = params.details
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 0;color:#71717a;width:40%">${escape(label)}</td><td style="padding:6px 0">${escape(value)}</td></tr>`,
    )
    .join("");
  const body = `${escape(params.intro)}</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;margin:0 0 24px;border-top:1px solid #e4e4e7;border-bottom:1px solid #e4e4e7">${rows}</table>
        <p style="font-size:15px;line-height:1.6;margin:0 0 24px"><strong>Ce n'était pas vous ?</strong> Changez votre mot de passe et déconnectez les sessions que vous ne reconnaissez pas.`;

  return {
    subject: params.subject,
    html: layout(
      params.title,
      body,
      { label: "Vérifier la sécurité de mon compte", url: params.url },
      "Cet email est envoyé automatiquement pour protéger votre compte.",
    ),
    text: [
      params.intro,
      "",
      ...params.details.map(([label, value]) => `${label} : ${value}`),
      "",
      `Ce n'était pas vous ? Changez votre mot de passe et vérifiez vos sessions : ${params.url}`,
    ].join("\n"),
  };
}
