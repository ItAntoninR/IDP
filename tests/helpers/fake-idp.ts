import { exportJWK, generateKeyPair, SignJWT } from "jose";

export const AUTHENTIK_ISSUER = process.env.AUTHENTIK_ISSUER!;
export const GOOGLE_ISSUER = "https://accounts.google.com";

export interface FakeProfile {
  sub: string;
  email: string;
  name?: string;
  emailVerified?: boolean;
  nonce?: string;
  amr?: string[];
}

const { publicKey, privateKey } = await generateKeyPair("RS256");
const jwk = { ...(await exportJWK(publicKey)), kid: "fake-idp", alg: "RS256", use: "sig" };

export const fakeCode = (profile: FakeProfile) => Buffer.from(JSON.stringify(profile)).toString("base64url");
const decodeCode = (code: string) => JSON.parse(Buffer.from(code, "base64url").toString()) as FakeProfile;

async function idToken(profile: FakeProfile, issuer: string, audience: string) {
  return new SignJWT({
    email: profile.email,
    email_verified: profile.emailVerified ?? true,
    name: profile.name ?? "Fake User",
    amr: profile.amr ?? ["pwd", "mfa"],
    ...(profile.nonce ? { nonce: profile.nonce } : {}),
  })
    .setProtectedHeader({ alg: "RS256", kid: jwk.kid })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject(profile.sub)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
}

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

async function readForm(init?: RequestInit, input?: string | URL | Request): Promise<URLSearchParams> {
  if (init?.body instanceof URLSearchParams) return init.body;
  if (typeof init?.body === "string") return new URLSearchParams(init.body);
  if (input instanceof Request) return new URLSearchParams(await input.clone().text());
  return new URLSearchParams();
}

async function tokenResponse(form: URLSearchParams, issuer: string, audience: string) {
  const code = form.get("code") ?? "";
  const profile = decodeCode(code);
  return json({
    access_token: `at.${code}`,
    token_type: "Bearer",
    expires_in: 3600,
    scope: "openid email profile",
    id_token: await idToken(profile, issuer, audience),
  });
}

const realFetch = globalThis.fetch;

globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

  if (url.startsWith(AUTHENTIK_ISSUER)) {
    const path = url.slice(AUTHENTIK_ISSUER.length);
    if (path.startsWith("/.well-known/openid-configuration")) {
      return json({
        issuer: AUTHENTIK_ISSUER,
        authorization_endpoint: `${AUTHENTIK_ISSUER}/authorize`,
        token_endpoint: `${AUTHENTIK_ISSUER}/token`,
        userinfo_endpoint: `${AUTHENTIK_ISSUER}/userinfo`,
        jwks_uri: `${AUTHENTIK_ISSUER}/jwks`,
        end_session_endpoint: `${AUTHENTIK_ISSUER}/end-session`,
        response_types_supported: ["code"],
        subject_types_supported: ["public"],
        id_token_signing_alg_values_supported: ["RS256"],
        scopes_supported: ["openid", "email", "profile"],
        code_challenge_methods_supported: ["S256"],
      });
    }
    if (path.startsWith("/jwks")) return json({ keys: [jwk] });
    if (path.startsWith("/token")) {
      return tokenResponse(await readForm(init, input), AUTHENTIK_ISSUER, process.env.AUTHENTIK_CLIENT_ID!);
    }
    if (path.startsWith("/userinfo")) {
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      const code = (headers.get("authorization") ?? "").replace(/^Bearer at\./, "");
      const p = decodeCode(code);
      return json({ sub: p.sub, email: p.email, email_verified: p.emailVerified ?? true, name: p.name ?? "Fake User" });
    }
  }

  if (url.startsWith("https://oauth2.googleapis.com/token")) {
    return tokenResponse(await readForm(init, input), GOOGLE_ISSUER, process.env.GOOGLE_CLIENT_ID!);
  }
  if (url.startsWith("https://www.googleapis.com/oauth2/v3/certs")) return json({ keys: [jwk] });

  return realFetch(input, init);
};
