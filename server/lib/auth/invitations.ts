import { env } from "../env";
import { sendEmailInBackground } from "../email/mailer";
import { invitationTemplate } from "../email/templates";

export const INVITATION_TTL_SECONDS = 60 * 60 * 24 * 7;

export function invitationUrl(invitationId: string, email: string): string {
  const url = new URL(`/invite/${encodeURIComponent(invitationId)}`, env.AUTH_BASE_URL);

  url.searchParams.set("email", email);

  return url.toString();
}

export function sendInvitation(params: {
  invitationId: string;
  email: string;
  organizationName: string;
  inviterName: string;
}): void {
  sendEmailInBackground(
    params.email,
    invitationTemplate({
      url: invitationUrl(params.invitationId, params.email),
      organizationName: params.organizationName,
      inviterName: params.inviterName,
    }),
  );
}
