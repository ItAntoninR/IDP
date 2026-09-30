# Auth service

Central identity provider (OAuth 2.1 / OpenID Connect) for the **Data hub** and the **App**. It owns users, organizations, roles and access; the client apps only verify the JWTs it issues.

- **Stack**: Nuxt 4 (Nitro API + Vue pages), Better Auth 1.7, PostgreSQL + Drizzle, shadcn-vue, Vitest.
- **Clients**: sign-in (password, magic link, Google), invitations, organization management, account page.
- **Staff**: sign-in through Authentik only, organization and user administration, impersonation, audit log.

## Layout

```
app/                 Vue pages, layouts, components (shadcn-vue in app/components/ui)
server/api/          Nitro handlers (Better Auth on api/auth/[...all].ts, admin, account, public)
server/lib/          Framework-agnostic core: Better Auth config, hooks, claims, Drizzle, emails
shared/permissions.ts  Permission catalogue shared by the server and the pages
scripts/             migrate, seed:clients, seed:demo
tests/               Vitest + Supertest against the built server
```

## Getting started

Requirements: Node 22.18+, pnpm 9, Docker.

```bash
docker compose up -d
```

```bash
cp .env.example .env
```

Set `BETTER_AUTH_SECRET` in `.env` (`openssl rand -base64 32`), then:

```bash
pnpm install
```

```bash
pnpm migrate
```

```bash
pnpm seed:clients
```

```bash
pnpm dev
```

`docker compose up -d` starts Postgres, Mailpit and a local Authentik. The service runs on http://localhost:3000, Mailpit on http://localhost:8025 and Authentik on http://localhost:9000. `pnpm seed:demo` adds demo organizations and accounts (local only; it prints their credentials).

### Local Authentik

The compose file ships an Authentik instance provisioned by a blueprint ([docker/authentik/blueprints/auth-service.yaml](docker/authentik/blueprints/auth-service.yaml)): an OIDC provider and application `auth-service`, a `staff` group bound to the application, and two test users. `.env.example` already contains the matching `AUTHENTIK_*` values.

| Account | Password | Expected result with "Continuer avec Authentik" on `/sign-in` |
|---|---|---|
| `staff` | `staff-password-123` | Signed in as a global admin. |
| `outsider` | `outsider-password-123` | Rejected by Authentik ("Permission refusée"): not in `staff`. |
| `akadmin` (Authentik admin UI) | `authentik-admin-123` | Authentik administration at http://localhost:9000/if/admin/. |

Authentik takes about a minute to start the first time. Start the auth service after it is up: the provider is discovered when the service boots, so restart `pnpm dev` if Authentik was not ready yet. These credentials are for local development only.

### Scripts

| Script | Description |
|---|---|
| `pnpm dev` | Nuxt dev server (API + pages). |
| `pnpm build` / `pnpm start` | Production build in `.output/`, then `node .output/server/index.mjs`. |
| `pnpm migrate` | Apply the SQL migrations. |
| `pnpm auth:generate` then `pnpm db:generate` | After changing the Better Auth config: regenerate `server/lib/db/auth-schema.ts`, then create a migration. |
| `pnpm seed:clients` | Register or update the Data hub and App OAuth clients (idempotent). |
| `pnpm seed:demo` | Demo data for local development. |
| `pnpm oauth:token` | Runs the whole OAuth flow for a user and prints the access token and its payload (local testing). |
| `pnpm test` | Build, start the server on port 3100 and run the tests (needs Postgres and Mailpit). `SKIP_BUILD=1` reuses the last build. |
| `pnpm typecheck` | Nuxt (app + server) and scripts/tests. |

## Getting a real access token

The whole OAuth flow can be run locally for a demo user, to inspect the token an app would receive.

1. Register the clients and keep their secrets for the token script:
   ```bash
   pnpm seed:clients --rotate-secrets
   ```
   Copy the two `client_secret` values into `.env` as `DATAHUB_CLIENT_SECRET` and `APP_CLIENT_SECRET`.
2. Get a real access token (options: `--app datahub|app`, `--user`, `--password`, `--org <slug>`):
   ```bash
   pnpm oauth:token --app datahub --user analyst@demo.test
   ```
   A user without access to the app gets `403 access_denied` and no token.

## Environment variables

Every variable is validated with zod at startup; the server refuses to start on invalid configuration. See [.env.example](.env.example) for the full, commented list.

| Variable | Purpose |
|---|---|
| `AUTH_BASE_URL` | Public URL, e.g. `https://auth.mondomaine.fr`. The issuer is `${AUTH_BASE_URL}/api/auth`. `https` enables `Secure` cookies. |
| `BETTER_AUTH_SECRET` | Signing and encryption secret (32+ characters). |
| `DATABASE_URL` | PostgreSQL connection string. |
| `DATAHUB_URL`, `APP_URL` | App origins, used for CORS and trusted origins. |
| `DATAHUB_RESOURCE`, `APP_RESOURCE` | Resource identifiers, i.e. the `aud` of each app's tokens. |
| `DATAHUB_REDIRECT_URIS`, `APP_REDIRECT_URIS` | OAuth redirect URIs, comma-separated. |
| `CLAIMS_NAMESPACE` | Prefix of the custom claims (default `https://mondomaine.fr`). |
| `ACCESS_TOKEN_TTL_SECONDS` | Access token lifetime (default 600). |
| `SMTP_*`, `MAIL_FROM` | Outgoing email. |
| `AUTHENTIK_ISSUER`, `AUTHENTIK_CLIENT_ID`, `AUTHENTIK_CLIENT_SECRET` | Staff sign-in. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional Google sign-in. |
| `RATE_LIMIT_ENABLED`, `TRUSTED_IP_HEADER` | Rate limiting and the header carrying the real client IP behind your proxy. |
| `MIGRATE_ON_START`, `MIGRATIONS_DIR` | Apply migrations when the server boots. |

## Authentik setup in production (staff sign-in)

Staff accounts are created on their first Authentik sign-in and get the global `admin` role. Who may sign in is decided in Authentik.

1. **Provider**: *Applications → Providers → Create → OAuth2/OpenID Provider*.
   - Client type: **Confidential**.
   - Redirect URI (strict): `https://auth.mondomaine.fr/api/auth/callback/authentik`.
   - Signing key: any RSA/EC certificate (tokens are verified against Authentik's JWKS).
   - Scopes: `openid`, `email`, `profile`.
   - Subject mode: based on the user's hashed ID (default).
2. **Application**: *Applications → Create*, slug `auth-service`, linked to the provider. Set its *Launch URL* to `https://auth.mondomaine.fr/sign-in?provider=authentik`: the application tile and Authentik's "Se reconnecter" button then sign staff in without a second click (`?provider=` starts that provider immediately; a bare `/sign-in` never does).
3. **Restrict to staff**: on the application, *Policy / Group / User Bindings → Bind existing group* → your staff group. Users outside the group are rejected by Authentik.
4. Copy the values into `.env`:
   - `AUTHENTIK_ISSUER=https://authentik.mondomaine.fr/application/o/auth-service` (the provider's *OpenID Configuration Issuer*),
   - `AUTHENTIK_CLIENT_ID` and `AUTHENTIK_CLIENT_SECRET` from the provider.

Everyone signs in on `/sign-in`. The last method used on the device (`lastLoginMethod` plugin, 30-day cookie) is offered first as a one-click button; there is no automatic redirect, which would sign staff straight back in after they sign out. Staff pick "Continuer avec Authentik" under "Options de connexion" and land on `/admin/orgs`; Authentik rejects anyone outside the staff group. `/admin/login` redirects to `/sign-in`.

### Second factor for staff

Staff MFA is enforced in Authentik, and checked by the service:

1. In Authentik, add an **Authenticator Validation** stage to the authentication flow used by the `auth-service` application, bound to the staff group, with *Not configured action* set to **Force the user to configure an authenticator** (TOTP and/or WebAuthn).
2. Keep `AUTHENTIK_REQUIRE_MFA=true` (the default). The service then rejects any staff sign-in whose Authentik `id_token` has no strong method in `amr` (`mfa`, `otp`, `hwk`, `swk`, `webauthn`…), with the message "Connexion refusée…". Without MFA Authentik sends `amr: ["pwd"]`.

The local Authentik has no MFA stage, so `.env.example` sets `AUTHENTIK_REQUIRE_MFA=false`.

## Two-factor authentication for clients

- **Per organization**: the owner (`Gérer l'organisation` → Sécurité) or an admin (organization detail) can require a second factor. Admin changes are recorded as `organization.security.update`.
- **Methods**: a passkey (recommended), or an authenticator app (TOTP) with 10 single-use backup codes; "trust this device" skips the TOTP code for 30 days. Either one satisfies the requirement.
- **Passkeys**: added from "Mon compte", then used with "Continuer avec une passkey" or straight from the email field (browser autofill). They only sign in existing accounts: sign-up stays invitation-only. The relying party is the host of `AUTH_BASE_URL`, so passkeys created on one domain do not work on another.
- **Enforcement**: a member of an organization that requires it must enable it before anything else (`/security/two-factor`), and no app token is issued until then. Magic links are refused for accounts that have or need a second factor, since they only prove mailbox access. Google sign-in is trusted as is.
- **Impersonation** bypasses the second factor: the admin acts without the user's code, and the action is audited.
- **Recovery**: no code by email (it is the password-reset channel, so it would collapse both factors into the mailbox). Users rely on backup codes or a passkey on another device; as a last resort an admin resets their second factors from the user detail ("Réinitialiser la double authentification"): the authenticator app and every passkey are removed, all sessions end, and `user.two_factor.reset` is audited. Staff factors are managed in Authentik.

## Microsoft (optional)

Create an **App registration** in the Azure portal (Microsoft Entra ID → App registrations → New registration):

1. *Supported account types*: **Accounts in any organizational directory** (multitenant, work accounts only).
2. *Redirect URI* (Web): `https://auth.mondomaine.fr/api/auth/callback/microsoft`.
3. *Certificates & secrets* → new client secret.
4. Optional but recommended: *Token configuration* → add the optional claim `verified_primary_email` to the ID token, so invited people can sign up directly with Microsoft.

Set `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET` (`MICROSOFT_TENANT_ID` defaults to `organizations`). Entra lets each company's admins set any email on their users, so Microsoft is not a trusted provider: an existing account is linked from "Mon compte → Profil" (same email), and a new account is created through Microsoft only when Microsoft verified the email; otherwise the person accepts the invitation first, then links Microsoft.

## Google (optional)

Create an OAuth client in Google Cloud with the redirect URI `https://auth.mondomaine.fr/api/auth/callback/google` and set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`. Google accounts are linked automatically to an existing account with the same email; new Google users still need a pending invitation.

## Registering the client apps

```bash
pnpm seed:clients
```

The script creates (or updates) one confidential client per app, trusted (no consent screen), allowed to request **only its own resource**, with the `authorization_code` and `refresh_token` grants. It prints each `client_id` and, on creation, the `client_secret`. Secrets are hashed at rest; `pnpm seed:clients --rotate-secrets` issues new ones.

Client settings for the apps:

| Setting | Value |
|---|---|
| Discovery | `https://auth.mondomaine.fr/api/auth/.well-known/openid-configuration` |
| Authorization endpoint | `https://auth.mondomaine.fr/api/auth/oauth2/authorize` |
| Token endpoint | `https://auth.mondomaine.fr/api/auth/oauth2/token` (HTTP Basic client authentication) |
| JWKS | `https://auth.mondomaine.fr/api/auth/jwks` |
| PKCE | Required (`S256`) |
| Scopes | `openid profile email offline_access` |
| `resource` parameter | Required, on both the authorize and token requests: the app's own resource. |

## Access token contract

Access tokens are JWTs signed with ES256.

| Claim | Value |
|---|---|
| `iss` | `https://auth.mondomaine.fr/api/auth` |
| `aud` | The requested resource (`DATAHUB_RESOURCE` or `APP_RESOURCE`). With the `openid` scope, `aud` is an array that also contains the userinfo endpoint. **Check that `aud` contains your resource.** A Data hub token never contains the App resource, and the other way round. |
| `sub` | User id. |
| `azp` | Client id. |
| `scope` | Granted scopes. |
| `exp` / `iat` | Lifetime of 10 minutes by default. |
| `https://mondomaine.fr/org_id` | The **single** organization this token acts for, chosen by the user during authorization. |
| `https://mondomaine.fr/access` | Object `{ "<orgId>": ["access", "export", ...] }` with exactly one entry, the `org_id` organization: the user's permissions on **this** app there, after intersecting the role permissions with the organization's allowed apps. |
| `https://mondomaine.fr/impersonated_by` | Admin user id. Present only while an admin is impersonating the user. |

Example payload for the Data hub:

```json
{
  "iss": "https://auth.mondomaine.fr/api/auth",
  "aud": ["https://datahub.mondomaine.fr", "https://auth.mondomaine.fr/api/auth/oauth2/userinfo"],
  "sub": "u_123",
  "azp": "DwLnMccQeKrJRKEkOaFwWrHzxmxsdYTv",
  "scope": "openid profile email offline_access",
  "iat": 1790600000,
  "exp": 1790600600,
  "https://mondomaine.fr/org_id": "org_acme",
  "https://mondomaine.fr/access": {
    "org_acme": ["access", "export", "admin"]
  }
}
```

Guarantees:

- **One organization per token**: a user who belongs to several organizations picks one on every authorization (`/select-organization`, which only lists the organizations granting access to the requested app and skips itself when there is only one). Refresh tokens keep that organization. Data of two clients can therefore never be mixed in one app session; to switch, the app restarts the authorization flow.
- **No access, no token**: if no organization grants `access` to the requested app, the token endpoint answers `403 access_denied` and issues nothing. The same applies to refresh requests, so removing a member, changing a role, lowering an organization's allowed apps or banning a user takes effect within one access-token lifetime.
- **Machine-to-machine tokens** (no user) carry no custom claim.
- **Impersonation** sessions never receive refresh tokens.
- Permission catalogue per app: `datahub: access, export, admin` and `app: access, admin` ([shared/permissions.ts](shared/permissions.ts)).


## Access model

- **Organizations** are created by staff (`/admin/orgs`) with a name, a slug, the allowed apps (`apps` ceiling) and the future owner's email; an `owner` invitation is sent. Staff never become members.
- **Roles**: `owner` (manages members, invitations and roles; every app permission) and `member` (no app permission). Owners create other roles at `/org`; they can only pick permissions of the apps allowed for their organization, and the server rejects anything outside that ceiling.
- **Sign-up is by invitation only**, whatever the method (password, magic link, Google), except staff coming from Authentik.
- **Audit log** (`/admin/audit`): impersonation start/stop, organization creation and ceiling changes, role changes, invitations, member role changes and removals, bans.

## Deployment

```bash
docker build -t auth-service .
```

The image runs `node .output/server/index.mjs` as a non-root user on port 3000 and ships the migrations in `/app/migrations` (`MIGRATE_ON_START=true` applies them at boot). Put it behind a TLS-terminating reverse proxy that sets the header named in `TRUSTED_IP_HEADER`. Run `pnpm seed:clients` from a checkout pointed at the production database to register the apps.

## Security notes

- **Leaked passwords** are refused on sign-up, password change and reset (Better Auth `haveIBeenPwned`: only the first 5 characters of the password's SHA-1 are sent to the service). If the service cannot be reached, the password is refused rather than accepted unchecked.
- **API reference** at `/api/auth/reference` (Better Auth OpenAPI, Scalar UI) and the raw schema at `/api/auth/open-api/generate-schema`, served to global admins only (404 for everyone else). It covers the Better Auth endpoints; apps integrate through OIDC discovery.
- Cookies are `httpOnly`, `sameSite=lax`, and `Secure` over https.
- CORS and trusted origins are limited to the app origins.
- Strict CSP (`script-src 'self'` plus hashes of Nuxt's inline boot scripts), `frame-ancestors 'none'`, HSTS over https.
- Better Auth rate limiting is stored in the database, with stricter limits on sign-in, sign-up, magic links, password reset and invitations.
- Every custom admin endpoint checks the global `admin` role on the server; organization operations go through Better Auth's permission checks.
- Logs are JSON and redact any key that looks like a secret (tokens, passwords, cookies).
