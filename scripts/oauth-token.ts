import { createHash, randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { decodeJwt } from "jose";
import { eq } from "drizzle-orm";
import { db, pool, schema } from "../server/lib/db/index";
import { env } from "../server/lib/env";
import { APPS } from "../server/lib/apps";
import { isAppId } from "../shared/permissions";

const { values } = parseArgs({
  options: {
    app: { type: "string", default: "datahub" },
    user: { type: "string", default: "owner@demo.test" },
    password: { type: "string", default: "auth-demo-7Rk2-quartz" },
    org: { type: "string" },
    scope: { type: "string", default: "openid profile email offline_access" },
  },
});

function fail(message: string): never {
  console.error(`\n${message}\n`);
  process.exit(1);
}

const appId = values.app!;

if (!isAppId(appId)) fail(`Unknown app "${appId}". Use one of: ${Object.keys(APPS).join(", ")}.`);
const app = APPS[appId];
const base = env.AUTH_BASE_URL;
const secretVar = `${appId.toUpperCase()}_CLIENT_SECRET`;
const clientSecret = process.env[secretVar];

const [client] = await db
  .select({ clientId: schema.oauthClient.clientId })
  .from(schema.oauthClient)
  .where(eq(schema.oauthClient.softwareId, `auth-service:${appId}`));

await pool.end();
if (!client) fail("OAuth clients are not registered yet. Run `pnpm seed:clients` first.");
if (!clientSecret) {
  fail(
    `Missing ${secretVar} in .env.\nRun \`pnpm seed:clients --rotate-secrets\` and copy the ${appId} client_secret into .env as ${secretVar}=...`,
  );
}

let cookies = "";
const remember = (res: Response) => {
  const set = res.headers.getSetCookie().map((c) => c.split(";")[0]);

  if (set.length) cookies = [...cookies.split("; ").filter(Boolean), ...set].join("; ");
};

const call = async (path: string, init: RequestInit = {}) => {
  const res = await fetch(new URL(path, base), {
    redirect: "manual",
    ...init,
    headers: {
      origin: base,
      cookie: cookies,
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
  });

  remember(res);

  return res;
};

const signIn = await call("/api/auth/sign-in/email", {
  method: "POST",
  body: JSON.stringify({ email: values.user, password: values.password }),
});

if (!signIn.ok) fail(`Sign-in failed for ${values.user} (${signIn.status}): ${await signIn.text()}`);

const verifier = randomBytes(32).toString("base64url");
const redirectUri = app.redirectUris[0]!;
const authorize = new URLSearchParams({
  response_type: "code",
  client_id: client.clientId,
  redirect_uri: redirectUri,
  scope: values.scope!,
  state: randomBytes(8).toString("base64url"),
  code_challenge: createHash("sha256").update(verifier).digest("base64url"),
  code_challenge_method: "S256",
  resource: app.resource,
});

const redirectTarget = async (res: Response) =>
  res.headers.get("location") ??
  (res.headers.get("content-type")?.includes("json") ? (((await res.json()) as { url?: string }).url ?? "") : "");

let location = await redirectTarget(await call(`/api/auth/oauth2/authorize?${authorize}`));

if (location.startsWith("/select-organization")) {
  const orgs = (await (await call("/api/account/organizations")).json()) as {
    organizations: { id: string; slug: string }[];
  };
  const org = values.org ? orgs.organizations.find((o) => o.slug === values.org) : orgs.organizations[0];

  if (!org) fail(`Organization "${values.org}" not found for ${values.user}.`);
  console.log(`Several organizations: selecting "${org.slug}" (use --org <slug> to choose).`);
  await call("/api/auth/organization/set-active", { method: "POST", body: JSON.stringify({ organizationId: org.id }) });
  const cont = await call("/api/auth/oauth2/continue", {
    method: "POST",
    body: JSON.stringify({ postLogin: true, oauth_query: location.split("?")[1] }),
  });

  location = await redirectTarget(cont);
}

const code = location.startsWith(redirectUri) ? new URL(location).searchParams.get("code") : null;

if (!code) fail(`Authorization did not return a code. Redirected to: ${location || "(nothing)"}`);

const tokenRes = await fetch(new URL("/api/auth/oauth2/token", base), {
  method: "POST",
  headers: {
    authorization: `Basic ${Buffer.from(`${client.clientId}:${clientSecret}`).toString("base64")}`,
    "content-type": "application/x-www-form-urlencoded",
  },
  body: new URLSearchParams({
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
    redirect_uri: redirectUri,
    resource: app.resource,
  }),
});
const tokens = (await tokenRes.json()) as Record<string, unknown>;

if (!tokenRes.ok) fail(`Token request refused (${tokenRes.status}): ${JSON.stringify(tokens)}`);

console.log(`\nAccess token for ${values.user} on ${app.label} (expires in ${tokens.expires_in}s):\n`);
console.log(tokens.access_token);
console.log("\nPayload:\n");
console.log(JSON.stringify(decodeJwt(String(tokens.access_token)), null, 2));
if (tokens.refresh_token) console.log("\nRefresh token issued (offline_access).");
