import { decodeJwt, type JWTPayload } from "jose";
import { env } from "../env";
import { logger } from "../support/logger";

const STRONG_METHODS = new Set(["mfa", "otp", "hwk", "swk", "sms", "webauthn"]);

export const usedStrongAuthentication = (amr: unknown) =>
  Array.isArray(amr) && amr.some((method) => typeof method === "string" && STRONG_METHODS.has(method));

export async function authentikUserInfo(tokens: { idToken?: string }) {
  if (!tokens.idToken) return null;
  const claims = decodeJwt(tokens.idToken) as JWTPayload & Record<string, unknown>;

  if (typeof claims.sub !== "string" || typeof claims.email !== "string") return null;
  if (env.AUTHENTIK_REQUIRE_MFA && !usedStrongAuthentication(claims.amr)) {
    logger.warn("authentik sign-in refused: no second factor", { sub: claims.sub, amr: claims.amr });

    return null;
  }

  return {
    ...claims,
    id: claims.sub,
    email: claims.email,
    emailVerified: claims.email_verified === true,
    name: typeof claims.name === "string" ? claims.name : undefined,
    image: typeof claims.picture === "string" ? claims.picture : undefined,
  };
}
