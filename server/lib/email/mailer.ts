import nodemailer from "nodemailer";
import { env } from "../env";
import { logger } from "../support/logger";
import type { EmailContent } from "./templates";

const transport = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  ...(env.SMTP_USER ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD ?? "" } } : {}),
});

export async function sendEmail(to: string, content: EmailContent): Promise<void> {
  await transport.sendMail({ from: env.MAIL_FROM, to, ...content });
  logger.info("email sent", { subject: content.subject, toDomain: to.split("@")[1] });
}

export function sendEmailInBackground(to: string, content: EmailContent): void {
  sendEmail(to, content).catch((err: unknown) => {
    logger.error("email send failed", { subject: content.subject, err });
  });
}
