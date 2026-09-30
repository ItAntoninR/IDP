# Protection des données personnelles (RGPD)

Ce document décrit les données personnelles traitées par le service d'authentification, pourquoi elles le sont, combien de temps elles sont conservées et comment les personnes exercent leurs droits. Il sert de base à la fiche du registre des traitements et à la politique de confidentialité.

> **À faire valider** par un juriste ou un délégué à la protection des données (DPO) avant la mise en production. Les éléments marqués **à compléter** doivent être renseignés.

Statut des mesures : ✅ en place

## 1. Responsable de traitement

| | |
|---|---|
| Responsable de traitement | **À compléter** : raison sociale, adresse, SIREN |
| Contact pour l'exercice des droits | **À compléter** : adresse email affichée dans la politique de confidentialité (par exemple `contact@…`) |
| Délégué à la protection des données | **À compléter** : si un DPO est désigné |
| Hébergement | France, chez LWS (base de données et service) |

L'entreprise est **responsable de traitement** pour les comptes gérés par ce service : elle décide pourquoi et comment ils sont créés, utilisés et supprimés. Les organisations clientes invitent leurs membres, mais ne décident pas des moyens du traitement.

## 2. Personnes concernées

- **Membres des organisations clientes** : personnes invitées par un gérant ou par l'équipe, qui accèdent aux applications.
- **Gérants des organisations clientes** : membres ayant le rôle de gérant.
- **Personnes invitées** qui n'ont pas encore accepté l'invitation (seule leur adresse email est connue).
- **Équipe interne (staff)** : administrateurs, dont le compte est géré dans Authentik.

## 3. Finalités et bases légales

| Finalité | Base légale (article 6 du RGPD) |
|---|---|
| Créer et gérer les comptes, permettre la connexion aux applications | Exécution du contrat avec l'organisation cliente et intérêt légitime à fournir un accès sécurisé à ses membres |
| Gérer les organisations, les rôles, les invitations et les droits d'accès aux applications | Exécution du contrat |
| Sécuriser les comptes : double authentification, alertes de nouvelle connexion, refus des mots de passe ayant fuité, limitation des tentatives | Intérêt légitime (sécurité du service et des comptes) |
| Tracer les actions sensibles dans un journal d'audit (rôles, invitations, impersonation, suppressions) | Intérêt légitime (sécurité, preuve, prévention des abus) |
| Assistance : impersonation par le support, réinitialisation de la 2FA | Intérêt légitime (assistance aux utilisateurs) |
| Conserver une archive après suppression pour répondre aux réquisitions des autorités | Obligation légale |

Aucune donnée n'est utilisée à des fins publicitaires, revendue ou utilisée pour du profilage.

## 4. Données traitées

| Catégorie | Données | Source |
|---|---|---|
| Identité | Nom, adresse email, statut de vérification de l'email | L'utilisateur, ou le fournisseur de connexion (Google, Microsoft, Authentik) |
| Connexion | Empreinte du mot de passe (jamais le mot de passe), comptes liés (Google, Microsoft, Authentik) et leur identifiant chez ce fournisseur | L'utilisateur, le fournisseur |
| Double authentification | Secret de l'application d'authentification et codes de secours (chiffrés), passkeys (nom, clé publique, type d'appareil) | L'utilisateur |
| Sessions | Date, adresse IP, navigateur (user agent), expiration, organisation active | Le navigateur |
| Appareils connus | Identifiant aléatoire d'appareil (stocké sous forme d'empreinte), navigateur, dates de première et dernière connexion | Le navigateur |
| Organisations | Organisations dont la personne est membre, rôle, date d'arrivée | Le gérant ou l'équipe |
| Invitations | Adresse email invitée, rôle, organisation, statut, dates, auteur de l'invitation | Le gérant ou l'équipe |
| Applications autorisées | Application, permissions accordées, organisation concernée, dates, jetons d'accès et de renouvellement | Le service |
| Journal d'audit | Auteur, action, cible, organisation, date, détails de l'action (par exemple l'email invité ou le rôle attribué) | Le service |
| Limitation des tentatives | Adresse IP et route appelée, sur une fenêtre d'une minute | Le navigateur |

Le service ne traite **aucune donnée sensible** au sens de l'article 9 du RGPD.

Les données créées dans les applications (DATA_HUB, etc.) ne sont **pas** stockées ici : chaque application documente ses propres traitements. Le service d'authentification ne leur transmet que l'identifiant de la personne, son nom, son email et ses permissions, dans les jetons d'accès.

## 5. Destinataires

- **Équipe interne** : administrateurs, pour l'assistance, la gestion des organisations et le traitement des demandes RGPD.
- **Gérants des organisations** : nom, email, rôle et statut de 2FA des membres de leur organisation, et journal d'activité de leur organisation.
- **Applications de l'entreprise** : identifiant, nom, email et permissions, dans les jetons d'accès, pour l'organisation choisie.

## 6. Sous-traitants et transferts

| Prestataire | Rôle | Localisation | Données concernées |
|---|---|---|---|
| LWS | Hébergement du service et de la base, envoi des emails | France | Toutes les données du service ; adresse email et contenu des emails envoyés |
| Google | Connexion avec un compte Google, si la personne la choisit | États-Unis (cadre EU-US Data Privacy Framework) | Échange d'identité au moment de la connexion |
| Microsoft | Connexion avec un compte professionnel Microsoft, si la personne la choisit | Union européenne et États-Unis (Data Privacy Framework) | Échange d'identité au moment de la connexion |
| Have I Been Pwned | Vérification qu'un nouveau mot de passe n'a pas fuité | Hors UE | Aucune donnée personnelle : seuls les 5 premiers caractères de l'empreinte SHA-1 du mot de passe sont envoyés |
| Authentik | Connexion de l'équipe interne | Auto-hébergé par l'entreprise | Comptes de l'équipe |

**À compléter** : vérifier que les conditions de LWS contiennent les clauses de sous-traitance de l'article 28 du RGPD.

## 7. Durées de conservation

| Donnée | Durée | Statut |
|---|---|---|
| Compte actif | Tant que le compte est utilisé | ✅ |
| Compte inactif | Supprimé après **3 ans** sans connexion, après un email d'avertissement envoyé **30 jours** avant. Le seul gérant d'une organisation n'est pas supprimé : il est signalé à l'équipe | ✅ |
| Session de connexion | 7 jours, 1 heure pour une session d'impersonation | ✅ |
| Jetons des applications | 10 minutes pour le jeton d'accès, 30 jours pour le jeton de renouvellement | ✅ |
| Appareil connu | Effacé après **13 mois** sans être revu | ✅ |
| Invitation | 7 jours de validité, puis effacée | ✅ |
| Liens envoyés par email (vérification, réinitialisation, lien de connexion, confirmation de suppression) | De 5 minutes à 24 heures selon le lien, puis inutilisables | ✅ |
| Limitation des tentatives | Fenêtre d'une minute | ✅ |
| Journal d'audit | **1 an**, puis effacé | ✅ |
| Archive après suppression du compte | **1 an**, puis effacée (voir la section 9) | ✅ |

Une tâche automatique applique ces durées chaque jour ✅. Elle ne tourne que sur un serveur à la fois, même s'il y en a plusieurs, et peut être désactivée avec la variable `RETENTION_ENABLED=false`. Elle efface aussi les sessions expirées, les liens envoyés par email expirés et les compteurs de tentatives de plus d'un jour.

## 8. Cookies

Tous les cookies déposés sont **strictement nécessaires** au service ou à sa sécurité. Ils sont donc exemptés de consentement.

| Cookie | Finalité | Durée |
|---|---|---|
| Session (`better-auth.session_token`) | Maintenir la connexion | 7 jours |
| Appareil de confiance (2FA) | Ne pas redemander le code de double authentification sur cet appareil | 30 jours |
| `auth_device` | Reconnaître le navigateur pour alerter d'une connexion depuis un nouvel appareil | 13 mois |
| `better-auth.last_used_login_method` | Proposer en premier la dernière méthode de connexion utilisée | 30 jours |

Tous les cookies sont `httpOnly`, `SameSite=Lax` et `Secure` en HTTPS. Aucun cookie de mesure d'audience ou de publicité n'est utilisé.

## 9. Suppression d'un compte

### Qui peut supprimer

- **La personne elle-même**, depuis sa page Profil. Un email de confirmation est envoyé, et le lien reste valable 1 heure. ✅
- **Un administrateur**, à la demande de la personne, depuis la fiche utilisateur. La personne est prévenue par email. ✅
- **Automatiquement**, après 3 ans d'inactivité (section 7). Un compte inactif dont la personne est le seul gérant d'une organisation est conservé, et une entrée « Compte inactif conservé (seul gérant) » est ajoutée au journal d'audit tous les 30 jours tant que la situation dure. ✅

La suppression est refusée pour le **seul gérant d'une organisation**, qui doit d'abord transférer son rôle, et pour les comptes de l'équipe, gérés dans Authentik. ✅

### Ce qui se passe ✅

Le compte est **pseudonymisé** plutôt que supprimé :

- **Conservé** : l'identifiant technique du compte. Les objets créés dans les applications restent ainsi rattachés à un auteur, affiché comme « Utilisateur supprimé ».
- **Effacé** : nom, adresse email (remplacée par une valeur inutilisable), mot de passe, comptes liés, double authentification, passkeys, sessions, appareils connus, adhésions aux organisations, autorisations et jetons des applications.
- **Connexion impossible** : plus aucun moyen de connexion ne subsiste, le compte est bloqué, et l'adresse email peut être réutilisée pour un nouveau compte, avec un nouvel identifiant.
- **Invitations envoyées** par la personne : elles restent valables, puisqu'elles concernent d'autres personnes.
- Dans l'administration, le compte apparaît comme « Supprimé », sans action possible.

### Archive de réquisition ✅

Au moment de la suppression, une archive est créée pour permettre de répondre aux **réquisitions des autorités** (obligation légale) :

- **Contenu** : identifiant, nom, email, date de création du compte, date de suppression, historique de connexion (dates, adresses IP, navigateurs).
- **Accès** : administrateurs uniquement, depuis la page Archives. Une recherche par email est obligatoire (les archives ne se parcourent pas), et chaque export est tracé dans le journal d'audit (« Consultation d'une archive »).
- **Durée** : 1 an, puis effacement automatique.

L'email de confirmation de suppression informe la personne de cette conservation.

### Journal d'audit

Les entrées existantes gardent l'identifiant de la personne. Elles sont effacées après 1 an, comme le reste du journal.

## 10. Droits des personnes

| Droit | Mise en œuvre | Statut |
|---|---|---|
| Accès (article 15) et portabilité (article 20) | Sur demande au contact indiqué en section 1. Un administrateur génère un export JSON depuis la fiche utilisateur ; l'export est tracé et la personne est prévenue par email | ✅ |
| Rectification (article 16) | La personne modifie son nom depuis sa page Profil. Pour l'email, sur demande | ✅ |
| Effacement (article 17) | Depuis la page Profil, ou sur demande (section 9) | ✅ |
| Opposition (article 21) et limitation (article 18) | Sur demande au contact indiqué en section 1, étudiée au cas par cas | Procédure manuelle |

**Délai de réponse** : 1 mois à compter de la demande, prolongeable de 2 mois pour une demande complexe, en prévenant la personne.

**Vérification de l'identité** : avant un export ou une suppression demandés hors de l'application, vérifier que la demande vient bien de l'adresse email du compte (par exemple en répondant depuis cette adresse).

**Contenu de l'export** : profil, moyens de connexion (sans secrets), passkeys (nom, type, date), appareils connus, sessions, organisations et rôles, invitations reçues et envoyées, applications autorisées, journal d'activité. Les secrets (empreinte du mot de passe, secrets de 2FA, clés de passkey, jetons) ne sont jamais exportés. Les données des applications sont exportées par chacune d'elles.

**Réclamation** : la personne peut saisir la CNIL (www.cnil.fr).

## 11. Sécurité

- Mots de passe stockés sous forme d'empreinte, minimum 10 caractères, refusés s'ils figurent dans une fuite connue.
- Double authentification disponible pour tous, et obligatoire si l'organisation l'exige. Passkeys avec vérification de l'utilisateur (code PIN ou biométrie).
- Alertes par email : nouvelle connexion, changement de mot de passe, activation ou désactivation de la 2FA, ajout ou suppression de passkey, réinitialisation par le support, export des données.
- Limitation des tentatives de connexion, chiffrement HTTPS, en-têtes de sécurité stricts (CSP, HSTS).
- Accès de l'équipe via Authentik, avec double authentification obligatoire en production.
- Impersonation par le support limitée à 1 heure, sans jeton de renouvellement, et tracée dans le journal.
- Journal d'audit des actions sensibles.
- Chaque organisation ne voit que ses propres membres et son propre journal.

## 12. Violation de données

En cas de violation de données (fuite, accès non autorisé, perte) :

1. Contenir l'incident et en évaluer l'étendue : données, personnes concernées, risques.
2. Si la violation présente un risque pour les personnes, la **notifier à la CNIL dans les 72 heures**.
3. Si le risque est élevé, **informer les personnes concernées** sans délai.
4. Consigner l'incident dans le registre des violations, même s'il n'est pas notifié.

**À compléter** : personne responsable de cette procédure.

## 13. Points ouverts

- Renseigner le responsable de traitement, l'adresse de contact et, le cas échéant, le DPO (section 1).
- Vérifier les clauses de sous-traitance de LWS (section 6).
- Faire valider ce document par un juriste ou un DPO.
- Rédiger la politique de confidentialité publique à partir de ce document.
