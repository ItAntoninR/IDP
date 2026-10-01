import { authClient, isGlobalAdmin } from "~/lib/auth-client";

const TWO_FACTOR_SETUP = "/security/two-factor";

export default defineNuxtRouteMiddleware(async (to) => {
  const { data } = await authClient.getSession();

  if (!data) return navigateTo({ path: "/sign-in", query: { callbackURL: to.fullPath } });
  if (isGlobalAdmin(data.user)) return;

  const { load, switchOrganization } = useAccountContext();
  const context = await load();

  const mustEnableTwoFactor =
    context.twoFactor.requiredBy.length > 0 && !context.twoFactor.enabled && !context.impersonating;

  if (mustEnableTwoFactor) {
    return to.path === TWO_FACTOR_SETUP
      ? undefined
      : navigateTo({ path: TWO_FACTOR_SETUP, query: { callbackURL: to.fullPath } });
  }

  if (to.path === TWO_FACTOR_SETUP) return navigateTo("/");
  if (context.active || to.path === "/select-organization") return;

  if (context.organizations.length === 1) {
    await switchOrganization(context.organizations[0]!.id);

    return;
  }

  if (context.organizations.length > 1) {
    return navigateTo({ path: "/select-organization", query: { callbackURL: to.fullPath } });
  }
});
