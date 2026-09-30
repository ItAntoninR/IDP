export const RESOURCE_LABELS: Record<string, string> = {
  organization: "Organisation",
  member: "Membres",
  invitation: "Invitations",
  ac: "Rôles",
  datahub: "Data hub",
  app: "App",
};

const ACTION_LABELS: Record<string, Record<string, string>> = {
  organization: { update: "Modifier les informations" },
  member: { create: "Ajouter", update: "Changer les rôles", delete: "Retirer" },
  invitation: { create: "Inviter", cancel: "Annuler une invitation" },
  ac: { create: "Créer", read: "Consulter", update: "Modifier", delete: "Supprimer" },
  datahub: { access: "Accès", export: "Export", admin: "Administration" },
  app: { access: "Accès", admin: "Administration" },
};

export const actionLabel = (resource: string, action: string) => ACTION_LABELS[resource]?.[action] ?? action;

export const roleLabel = (role: string) =>
  role
    .split(",")
    .map((r) => (r === "owner" ? "Gérant" : r === "member" ? "Membre" : r))
    .join(", ");

export const AUDIT_LABELS: Record<string, string> = {
  "impersonation.start": "Début d'impersonation",
  "impersonation.stop": "Fin d'impersonation",
  "organization.create": "Création d'organisation",
  "organization.update": "Modification d'organisation",
  "organization.ceiling.update": "Modification du plafond",
  "organization.security.update": "Règle de double authentification",
  "organization.delete": "Suppression d'organisation",
  "organization.owner.transfer": "Transfert du rôle de gérant",
  "role.create": "Création de rôle",
  "role.update": "Modification de rôle",
  "role.delete": "Suppression de rôle",
  "invitation.create": "Invitation",
  "member.role.update": "Changement de rôle",
  "member.remove": "Retrait de membre",
  "member.leave": "Départ d'un membre",
  "user.ban": "Suspension",
  "user.unban": "Levée de suspension",
  "user.role.update": "Changement de rôle global",
  "user.two_factor.reset": "Réinitialisation de la 2FA",
  "user.delete": "Suppression de compte",
};

export const formatDate = (value: string | Date | null | undefined) =>
  value ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";

const ROLE_DESCRIPTIONS: Record<string, string> = {
  owner: "Gestion complète et accès à toutes les applications autorisées",
  member: "Aucune permission d'application",
};

export const roleOptions = (roles: string[]) =>
  [...new Set(roles)].map((role) => ({
    value: role,
    label: roleLabel(role),
    description: ROLE_DESCRIPTIONS[role] ?? "Rôle personnalisé",
  }));
