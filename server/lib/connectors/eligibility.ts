import { hasOrganizationPermission, userMemberships } from "../account-context";
import { CONNECTOR_APP } from "../../../shared/permissions";

export const canPairConnectors = (headers: Headers, organizationId: string) =>
  hasOrganizationPermission(headers, organizationId, { connector: ["create"] });

export async function pairingOrganizations(headers: Headers, userId: string) {
  const memberships = await userMemberships(userId);
  const withApp = memberships.filter((o) => o.apps.some((a) => a.id === CONNECTOR_APP));
  const allowed = await Promise.all(withApp.map((o) => canPairConnectors(headers, o.id)));

  return withApp
    .filter((_, i) => allowed[i])
    .map((o) => ({ id: o.id, name: o.name, slug: o.slug, logoUrl: o.logoUrl }));
}
