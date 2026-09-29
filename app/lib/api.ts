export interface AppLink {
  id: string;
  label: string;
  url: string;
}

export interface PublicConfig {
  googleEnabled: boolean;
  microsoftEnabled: boolean;
  authentikEnabled: boolean;
  apps: AppLink[];
}

export interface MyOrganization {
  id: string;
  name: string;
  slug: string;
  role: string;
  apps: AppLink[];
  requireTwoFactor: boolean;
}

let configPromise: Promise<PublicConfig> | undefined;
export const getPublicConfig = () => (configPromise ??= $fetch<PublicConfig>("/api/public/config"));

export const getMyOrganizations = () =>
  $fetch<{ organizations: MyOrganization[] }>("/api/account/organizations").then((r) => r.organizations);
