# Service d'authentification

Fournisseur d'identité central (OAuth 2.1 / OpenID Connect) pour le **Data hub** et l'**App**. Il gère les utilisateurs, les organisations, les rôles et les accès ; les applications se contentent de vérifier les JWT qu'il émet.

- **Technique** : Nuxt 4 (API Nitro + pages Vue), Better Auth 1.7, PostgreSQL + Drizzle, shadcn-vue, Vitest.
- **Clients** : connexion (mot de passe, lien par email, passkey, Google, Microsoft), invitations, gestion de l'organisation, espace « Mon compte ».
- **Équipe** : connexion uniquement via Authentik, administration des organisations et des utilisateurs, impersonation, journal d'audit, archives.

## Organisation du code

```
app/                 Pages, layouts et composants Vue (shadcn-vue dans app/components/ui)
server/api/          Routes Nitro (Better Auth sur api/auth/[...all].ts, admin, account, public)
server/lib/          Cœur indépendant du framework : configuration Better Auth, hooks, claims, Drizzle, emails
server/plugins/      Migrations au démarrage, en-têtes de sécurité, purge quotidienne
shared/permissions.ts  Catalogue des permissions partagé entre le serveur et les pages
scripts/             migrate, seed:clients, seed:demo, oauth:token
tests/               Vitest + Supertest sur le serveur compilé
docs/RGPD.md         Données personnelles, durées de conservation et droits des personnes
```

## Démarrage

Prérequis : Node 22.18+, pnpm 9, Docker.

```bash
docker compose up -d
```

```bash
cp .env.example .env
```

Renseignez `BETTER_AUTH_SECRET` dans `.env` (`openssl rand -base64 32`), puis :

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

`docker compose up -d` démarre Postgres, Mailpit et un Authentik local. Le service tourne sur http://localhost:3000, Mailpit sur http://localhost:8025 et Authentik sur http://localhost:9000. `pnpm seed:demo` ajoute des organisations et des comptes de démonstration (en local uniquement ; il affiche leurs identifiants).

### Authentik en local

Le fichier compose fournit une instance Authentik configurée par un blueprint ([docker/authentik/blueprints/auth-service.yaml](docker/authentik/blueprints/auth-service.yaml)) : un fournisseur OIDC et une application `auth-service`, un groupe `staff` lié à l'application et deux utilisateurs de test. `.env.example` contient déjà les valeurs `AUTHENTIK_*` correspondantes.

| Compte                               | Mot de passe            | Résultat attendu avec « Continuer avec Authentik » sur `/sign-in`          |
| ------------------------------------ | ----------------------- | -------------------------------------------------------------------------- |
| `staff`                              | `staff-password-123`    | Connecté en administrateur global.                                         |
| `outsider`                           | `outsider-password-123` | Refusé par Authentik (« Permission refusée ») : il n'est pas dans `staff`. |
| `akadmin` (administration Authentik) | `authentik-admin-123`   | Administration d'Authentik sur http://localhost:9000/if/admin/.            |

Authentik met environ une minute à démarrer la première fois. Lancez le service d'authentification une fois Authentik prêt : le fournisseur est découvert au démarrage du service, relancez donc `pnpm dev` si Authentik n'était pas encore disponible. Ces identifiants servent uniquement au développement local.

### Scripts

| Script                                       | Description                                                                                                                              |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                                   | Serveur de développement Nuxt (API + pages).                                                                                             |
| `pnpm build` / `pnpm start`                  | Build de production dans `.output/`, puis `node .output/server/index.mjs`.                                                               |
| `pnpm migrate`                               | Applique les migrations SQL.                                                                                                             |
| `pnpm auth:generate` puis `pnpm db:generate` | Après une modification de la configuration Better Auth : régénère `server/lib/db/auth-schema.ts`, puis crée une migration.               |
| `pnpm seed:clients`                          | Enregistre ou met à jour les clients OAuth du Data hub et de l'App (idempotent).                                                         |
| `pnpm seed:demo`                             | Données de démonstration pour le développement local.                                                                                    |
| `pnpm oauth:token`                           | Déroule tout le parcours OAuth pour un utilisateur et affiche le jeton d'accès et son contenu (tests en local).                          |
| `pnpm test`                                  | Compile, démarre le serveur sur le port 3100 et lance les tests (Postgres et Mailpit requis). `SKIP_BUILD=1` réutilise le dernier build. |
| `pnpm typecheck`                             | Nuxt (app + serveur), puis scripts et tests.                                                                                             |

## Obtenir un vrai jeton d'accès

Le parcours OAuth complet peut être déroulé en local pour un utilisateur de démonstration, afin d'examiner le jeton que recevrait une application.

1. Enregistrez les clients et gardez leurs secrets pour le script :
   ```bash
   pnpm seed:clients --rotate-secrets
   ```
   Copiez les deux valeurs `client_secret` dans `.env`, dans `DATAHUB_CLIENT_SECRET` et `APP_CLIENT_SECRET`.
2. Obtenez un jeton d'accès (options : `--app datahub|app`, `--user`, `--password`, `--org <slug>`) :
   ```bash
   pnpm oauth:token --app datahub --user analyst@demo.test
   ```
   Un utilisateur sans accès à l'application reçoit `403 access_denied` et aucun jeton.

## Variables d'environnement

Chaque variable est validée avec zod au démarrage ; le serveur refuse de démarrer si la configuration est invalide. La liste complète figure dans [.env.example](.env.example).

| Variable                                                                                      | Rôle                                                                                                                                                  |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AUTH_BASE_URL`                                                                               | URL publique, par exemple `https://auth.mondomaine.fr`. L'émetteur des jetons est `${AUTH_BASE_URL}/api/auth`. En `https`, les cookies sont `Secure`. |
| `BETTER_AUTH_SECRET`                                                                          | Secret de signature et de chiffrement (32 caractères minimum).                                                                                        |
| `DATABASE_URL`                                                                                | Chaîne de connexion PostgreSQL.                                                                                                                       |
| `DATAHUB_URL`, `APP_URL`                                                                      | Origines des applications, pour le CORS et les origines de confiance.                                                                                 |
| `DATAHUB_RESOURCE`, `APP_RESOURCE`                                                            | Identifiants de ressource, c'est-à-dire le `aud` des jetons de chaque application.                                                                    |
| `DATAHUB_REDIRECT_URIS`, `APP_REDIRECT_URIS`                                                  | URI de redirection OAuth, séparées par des virgules.                                                                                                  |
| `CLAIMS_NAMESPACE`                                                                            | Préfixe des claims personnalisés (par défaut `https://mondomaine.fr`).                                                                                |
| `ACCESS_TOKEN_TTL_SECONDS`                                                                    | Durée de vie du jeton d'accès (600 par défaut).                                                                                                       |
| `SMTP_*`, `MAIL_FROM`                                                                         | Envoi des emails.                                                                                                                                     |
| `AUTHENTIK_ISSUER`, `AUTHENTIK_CLIENT_ID`, `AUTHENTIK_CLIENT_SECRET`, `AUTHENTIK_REQUIRE_MFA` | Connexion de l'équipe.                                                                                                                                |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`                                                    | Connexion Google (facultative).                                                                                                                       |
| `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID`                       | Connexion Microsoft (facultative).                                                                                                                    |
| `RATE_LIMIT_ENABLED`, `TRUSTED_IP_HEADER`                                                     | Limitation des tentatives, et en-tête qui porte la vraie adresse IP derrière votre proxy.                                                             |
| `MIGRATE_ON_START`, `MIGRATIONS_DIR`                                                          | Appliquer les migrations au démarrage du serveur.                                                                                                     |
| `RETENTION_ENABLED`                                                                           | Purge quotidienne des données arrivées au terme de leur durée de conservation (activée par défaut, voir [docs/RGPD.md](docs/RGPD.md)).                |

## Configurer Authentik en production (connexion de l'équipe)

Les comptes de l'équipe sont créés à leur première connexion via Authentik et reçoivent le rôle global `admin`. C'est Authentik qui décide qui peut se connecter.

1. **Fournisseur** : _Applications → Providers → Create → OAuth2/OpenID Provider_.
   - Type de client : **Confidential**.
   - URI de redirection (strict) : `https://auth.mondomaine.fr/api/auth/callback/authentik`.
   - Clé de signature : n'importe quel certificat RSA ou EC (les jetons sont vérifiés avec le JWKS d'Authentik).
   - Scopes : `openid`, `email`, `profile`.
   - Subject mode : basé sur l'identifiant haché de l'utilisateur (valeur par défaut).
2. **Application** : _Applications → Create_, slug `auth-service`, liée au fournisseur. Réglez sa _Launch URL_ sur `https://auth.mondomaine.fr/sign-in?provider=authentik` : la tuile de l'application et le bouton « Se reconnecter » d'Authentik connectent alors l'équipe sans second clic (`?provider=` lance ce fournisseur immédiatement ; un simple `/sign-in` ne le fait jamais).
3. **Réserver à l'équipe** : sur l'application, _Policy / Group / User Bindings → Bind existing group_ → votre groupe d'équipe. Authentik refuse les utilisateurs hors de ce groupe.
4. Reportez les valeurs dans `.env` :
   - `AUTHENTIK_ISSUER=https://authentik.mondomaine.fr/application/o/auth-service` (l'_OpenID Configuration Issuer_ du fournisseur),
   - `AUTHENTIK_CLIENT_ID` et `AUTHENTIK_CLIENT_SECRET`, depuis le fournisseur.

Tout le monde se connecte sur `/sign-in`. La dernière méthode utilisée sur l'appareil (plugin `lastLoginMethod`, cookie de 30 jours) est proposée en premier, en un clic ; il n'y a pas de redirection automatique, qui reconnecterait l'équipe juste après sa déconnexion. L'équipe choisit « Continuer avec Authentik » dans « Options de connexion » et arrive sur `/admin/orgs` ; Authentik refuse toute personne hors du groupe. `/admin/login` redirige vers `/sign-in`.

### Second facteur pour l'équipe

La double authentification de l'équipe est imposée par Authentik et vérifiée par le service :

1. Dans Authentik, ajoutez une étape **Authenticator Validation** au flux d'authentification de l'application `auth-service`, liée au groupe de l'équipe, avec _Not configured action_ réglé sur **Force the user to configure an authenticator** (TOTP et/ou WebAuthn).
2. Gardez `AUTHENTIK_REQUIRE_MFA=true` (valeur par défaut). Le service refuse alors toute connexion de l'équipe dont l'`id_token` Authentik ne contient aucune méthode forte dans `amr` (`mfa`, `otp`, `hwk`, `swk`, `webauthn`…), avec le message « Connexion refusée… ». Sans double authentification, Authentik envoie `amr: ["pwd"]`.

L'Authentik local n'a pas d'étape de double authentification, c'est pourquoi `.env.example` contient `AUTHENTIK_REQUIRE_MFA=false`.

## Double authentification des clients

- **Par organisation** : le gérant (Paramètres → Sécurité) ou un administrateur (détail de l'organisation) peut exiger un second facteur. Les changements sont tracés (`organization.security.update`).
- **Méthodes** : une passkey (recommandé), ou une application d'authentification (TOTP) avec 10 codes de secours à usage unique ; « faire confiance à cet appareil » évite le code TOTP pendant 30 jours. L'une ou l'autre satisfait l'exigence.
- **Passkeys** : ajoutées depuis « Mon compte », puis utilisées avec « Continuer avec une passkey » ou directement depuis le champ email (saisie automatique du navigateur). Elles ne connectent que des comptes existants : l'inscription reste sur invitation. Le domaine de rattachement est celui d'`AUTH_BASE_URL` : une passkey créée sur un domaine ne fonctionne pas sur un autre.
- **Application** : un membre d'une organisation qui l'exige doit l'activer avant toute autre action (`/security/two-factor`), et aucun jeton d'application n'est émis d'ici là. Les liens par email sont refusés aux comptes qui ont ou doivent avoir un second facteur, car ils ne prouvent que l'accès à la boîte mail. La connexion Google est acceptée telle quelle.
- **Impersonation** : elle contourne le second facteur ; l'administrateur agit sans le code de l'utilisateur, et l'action est tracée.
- **Récupération** : pas de code par email (c'est le canal de réinitialisation du mot de passe, les deux facteurs se réduiraient à la boîte mail). Les utilisateurs utilisent leurs codes de secours ou une passkey sur un autre appareil ; en dernier recours, un administrateur réinitialise leurs seconds facteurs depuis la fiche utilisateur (« Réinitialiser la double authentification ») : l'application d'authentification et toutes les passkeys sont supprimées, toutes les sessions sont fermées, et `user.two_factor.reset` est tracé. Les facteurs de l'équipe se gèrent dans Authentik.

## Microsoft (facultatif)

Créez une **App registration** dans le portail Azure (Microsoft Entra ID → App registrations → New registration) :

1. _Supported account types_ : **Accounts in any organizational directory** (multi-tenant, comptes professionnels uniquement).
2. _Redirect URI_ (Web) : `https://auth.mondomaine.fr/api/auth/callback/microsoft`.
3. _Certificates & secrets_ → nouveau secret client.
4. Facultatif mais recommandé : _Token configuration_ → ajoutez le claim optionnel `verified_primary_email` à l'ID token, pour que les personnes invitées puissent s'inscrire directement avec Microsoft.

Renseignez `MICROSOFT_CLIENT_ID` et `MICROSOFT_CLIENT_SECRET` (`MICROSOFT_TENANT_ID` vaut `organizations` par défaut). Entra permet aux administrateurs de chaque entreprise de donner n'importe quel email à leurs utilisateurs : Microsoft n'est donc pas un fournisseur de confiance. Un compte existant se lie depuis « Mon compte → Profil » (même email), et un nouveau compte n'est créé via Microsoft que si Microsoft a vérifié l'email ; sinon, la personne accepte d'abord l'invitation, puis lie Microsoft.

## Google (facultatif)

Créez un client OAuth dans Google Cloud avec l'URI de redirection `https://auth.mondomaine.fr/api/auth/callback/google` et renseignez `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`. Un compte Google est lié automatiquement à un compte existant ayant le même email ; un nouvel utilisateur Google a quand même besoin d'une invitation en attente.

## Enregistrer les applications clientes

```bash
pnpm seed:clients
```

Le script crée (ou met à jour) un client confidentiel par application, de confiance (sans écran de consentement), autorisé à demander **uniquement sa propre ressource**, avec les grants `authorization_code` et `refresh_token`. Il affiche chaque `client_id` et, à la création, le `client_secret`. Les secrets sont stockés hachés ; `pnpm seed:clients --rotate-secrets` en émet de nouveaux.

Réglages à utiliser dans les applications :

| Réglage              | Valeur                                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| Découverte           | `https://auth.mondomaine.fr/api/auth/.well-known/openid-configuration`                                    |
| Autorisation         | `https://auth.mondomaine.fr/api/auth/oauth2/authorize`                                                    |
| Jeton                | `https://auth.mondomaine.fr/api/auth/oauth2/token` (authentification du client en HTTP Basic)             |
| JWKS                 | `https://auth.mondomaine.fr/api/auth/jwks`                                                                |
| PKCE                 | Obligatoire (`S256`)                                                                                      |
| Scopes               | `openid profile email offline_access`                                                                     |
| Paramètre `resource` | Obligatoire, sur la demande d'autorisation comme sur la demande de jeton : la ressource de l'application. |

## Contenu des jetons d'accès

Les jetons d'accès sont des JWT signés en ES256.

| Claim                                   | Valeur                                                                                                                                                                                                                                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `iss`                                   | `https://auth.mondomaine.fr/api/auth`                                                                                                                                                                                                                                                       |
| `aud`                                   | La ressource demandée (`DATAHUB_RESOURCE` ou `APP_RESOURCE`). Avec le scope `openid`, `aud` est un tableau qui contient aussi l'endpoint userinfo. **Vérifiez que `aud` contient votre ressource.** Un jeton du Data hub ne contient jamais la ressource de l'App, et inversement.          |
| `sub`                                   | Identifiant de l'utilisateur.                                                                                                                                                                                                                                                               |
| `name` / `email`                        | Nom et email de l'utilisateur, pour personnaliser les écrans.                                                                                                                                                                                                                               |
| `azp`                                   | Identifiant du client.                                                                                                                                                                                                                                                                      |
| `scope`                                 | Scopes accordés.                                                                                                                                                                                                                                                                            |
| `exp` / `iat`                           | Durée de vie de 10 minutes par défaut.                                                                                                                                                                                                                                                      |
| `https://mondomaine.fr/org_id`          | L'**unique** organisation pour laquelle ce jeton agit, choisie par l'utilisateur pendant l'autorisation.                                                                                                                                                                                    |
| `https://mondomaine.fr/org_name`        | Nom de cette organisation. Un changement de nom apparaît au prochain renouvellement du jeton.                                                                                                                                                                                               |
| `https://mondomaine.fr/org_count`       | Nombre d'organisations de l'utilisateur qui donnent accès à **cette** application. Au-dessus de 1, l'application peut proposer de changer d'organisation.                                                                                                                                   |
| `https://mondomaine.fr/access`          | Objet `{ "<orgId>": ["access", "export", ...] }` avec une seule entrée, l'organisation `org_id` : les permissions de l'utilisateur sur **cette** application dans cette organisation, après intersection des permissions de ses rôles avec les applications autorisées pour l'organisation. |
| `https://mondomaine.fr/impersonated_by` | Identifiant de l'administrateur. Présent uniquement pendant une impersonation.                                                                                                                                                                                                              |

Exemple de contenu pour le Data hub :

```json
{
  "iss": "https://auth.mondomaine.fr/api/auth",
  "aud": ["https://datahub.mondomaine.fr", "https://auth.mondomaine.fr/api/auth/oauth2/userinfo"],
  "sub": "u_123",
  "name": "Olivia Owner",
  "email": "owner@acme.fr",
  "azp": "DwLnMccQeKrJRKEkOaFwWrHzxmxsdYTv",
  "scope": "openid profile email offline_access",
  "iat": 1790600000,
  "exp": 1790600600,
  "https://mondomaine.fr/org_id": "org_acme",
  "https://mondomaine.fr/org_name": "Acme",
  "https://mondomaine.fr/org_count": 1,
  "https://mondomaine.fr/access": {
    "org_acme": ["access", "export", "admin"]
  }
}
```

Garanties :

- **Une organisation par jeton** : un utilisateur membre de plusieurs organisations en choisit une à chaque autorisation (`/select-organization`, qui ne liste que les organisations donnant accès à l'application demandée et se passe d'elle-même s'il n'y en a qu'une). Les jetons de renouvellement gardent cette organisation. Les données de deux clients ne peuvent donc jamais se mélanger dans une même session d'application ; pour changer d'organisation, l'application relance l'autorisation.
- **Forcer le choix de l'organisation** : une application ajoute `prompt=select_account` à la demande d'autorisation (bouton « Changer d'organisation »). La page de choix s'affiche alors toujours, même si l'utilisateur n'a qu'une seule organisation.
- **Pas d'accès, pas de jeton** : si aucune organisation ne donne `access` à l'application demandée, l'endpoint de jeton répond `403 access_denied` et n'émet rien. C'est vrai aussi au renouvellement : retirer un membre, changer un rôle, réduire les applications autorisées d'une organisation ou suspendre un utilisateur prend effet en une durée de vie de jeton d'accès.
- **Jetons machine à machine** (sans utilisateur) : aucun claim personnalisé.
- **Sessions d'impersonation** : jamais de jeton de renouvellement.
- Catalogue des permissions par application : `datahub: access, export, admin` et `app: access, admin` ([shared/permissions.ts](shared/permissions.ts)).

## Modèle d'accès

- **Organisations** : créées par l'équipe (`/admin/orgs`) avec un nom, un slug, les applications autorisées (plafond `apps`) et l'email du futur gérant, qui reçoit une invitation. L'équipe peut ensuite inviter une personne avec n'importe quel rôle de l'organisation. Les membres de l'équipe ne deviennent jamais membres.
- **Rôles** : `owner` (gérant : membres, invitations, rôles, paramètres ; toutes les permissions d'application) et `member` (aucune permission d'application). Les gérants créent d'autres rôles depuis leur espace ; ils ne peuvent choisir que des permissions sur les applications autorisées pour leur organisation, et le serveur refuse tout ce qui dépasse ce plafond.
- **Gérants** : ils modifient le nom et le logo de l'organisation (Paramètres) et peuvent transférer leur rôle à un autre membre. L'organisation garde toujours au moins un gérant.
- **Membres** : ils peuvent quitter une organisation depuis « Mon compte → Profil ».
- **Inscription sur invitation uniquement**, quelle que soit la méthode (mot de passe, lien par email, Google, Microsoft), sauf pour l'équipe venant d'Authentik.
- **Journal d'audit** (`/admin/audit`) : impersonation, création, modification et suppression d'organisations, plafonds, rôles, invitations, changements de rôle, retraits et départs de membres, transferts du rôle de gérant, suspensions, suppressions et exports de comptes, ainsi que l'activation ou la désactivation de la double authentification et l'ajout ou la suppression de passkeys par l'utilisateur lui-même.

## Déploiement

```bash
docker build -t auth-service .
```

L'image lance `node .output/server/index.mjs` avec un utilisateur non root sur le port 3000 et embarque les migrations dans `/app/migrations` (`MIGRATE_ON_START=true` les applique au démarrage). Placez-la derrière un reverse proxy qui termine le TLS et renseigne l'en-tête indiqué dans `TRUSTED_IP_HEADER`. Lancez `pnpm seed:clients` depuis une copie du dépôt pointée sur la base de production pour enregistrer les applications.

## Sécurité

- **Mots de passe ayant fuité** : refusés à l'inscription, au changement et à la réinitialisation (plugin Better Auth `haveIBeenPwned` : seuls les 5 premiers caractères de l'empreinte SHA-1 du mot de passe sont envoyés au service). Si le service est injoignable, le mot de passe est refusé plutôt qu'accepté sans vérification.
- **Documentation de l'API** sur `/api/auth/reference` (OpenAPI de Better Auth, interface Scalar) et schéma brut sur `/api/auth/open-api/generate-schema`, réservés aux administrateurs (404 pour tous les autres). Elle couvre les endpoints Better Auth ; les applications s'intègrent via la découverte OIDC.
- **Alertes de sécurité** par email : connexion depuis un nouveau navigateur (reconnu par un cookie aléatoire `auth_device`, stocké haché dans `known_device` ; le premier navigateur d'un compte et les sessions d'impersonation ne déclenchent pas d'alerte), mot de passe modifié ou réinitialisé, double authentification activée ou désactivée, passkey ajoutée ou supprimée, seconds facteurs réinitialisés par le support, export des données.
- **RGPD** : les données personnelles, les durées de conservation, la suppression et les droits des personnes sont décrits dans [docs/RGPD.md](docs/RGPD.md).
- **Suppression de compte** : depuis la page Profil, confirmée par un lien envoyé par email et valable 1 heure (`POST /api/account/deletion`, puis `/api/account/deletion/confirm`), ou par un administrateur à la demande de la personne (`DELETE /api/admin/users/:id`). Le compte est **pseudonymisé** : l'identifiant reste pour les applications, tout le reste est effacé. Une archive (identité et historique de connexion) est gardée 1 an pour les réquisitions des autorités, consultable depuis `/admin/archives`. La suppression est refusée au seul gérant d'une organisation et aux comptes de l'équipe. Les routes de suppression de Better Auth (`/delete-user`, `/admin/remove-user`) sont désactivées.
- **Export des données** (droit d'accès), réservé aux administrateurs pour l'instant : `GET /api/admin/users/:id/export` renvoie un fichier JSON (profil, moyens de connexion, passkeys, appareils connus, sessions, organisations, invitations, applications autorisées, activité). Les secrets (empreinte du mot de passe, secrets de 2FA, clés de passkey, jetons) ne sont jamais inclus ; chaque export est tracé et la personne est prévenue par email.
- **Durées de conservation** appliquées chaque jour par une tâche qui ne tourne que sur un serveur à la fois : journal d'audit 1 an, appareils connus 13 mois sans activité, archives 1 an, invitations et liens expirés, comptes inactifs supprimés après 3 ans (avec un avertissement 30 jours avant).
- **Suppression d'organisation** : réservée aux administrateurs, avec saisie du slug pour confirmer ; elle supprime les membres, les invitations, les rôles, ainsi que les consentements et jetons de renouvellement liés à l'organisation.
- **Logos des organisations** : images PNG, JPEG ou WebP (réduites à 256 px dans le navigateur, 200 Ko maximum, jamais de SVG), servies par `/api/public/organizations/:id/logo?v=<empreinte>` avec un cache permanent.
- Les cookies sont `httpOnly`, `sameSite=lax` et `Secure` en HTTPS.
- Le CORS et les origines de confiance sont limités aux origines des applications.
- CSP stricte (`script-src 'self'` plus les empreintes des scripts de démarrage de Nuxt), `frame-ancestors 'none'`, HSTS en HTTPS.
- La limitation des tentatives de Better Auth est stockée en base, avec des limites plus strictes sur la connexion, l'inscription, les liens par email, la réinitialisation du mot de passe et les invitations.
- Chaque route d'administration vérifie le rôle global `admin` côté serveur ; les opérations sur les organisations passent par les contrôles de permissions de Better Auth.
- Les logs sont en JSON et masquent toute clé ressemblant à un secret (jetons, mots de passe, cookies).
