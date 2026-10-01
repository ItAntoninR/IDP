import { authClient, isGlobalAdmin } from "~/lib/auth-client";

export default defineNuxtRouteMiddleware(async (to) => {
  const { data } = await authClient.getSession();

  if (!data || !isGlobalAdmin(data.user)) {
    return navigateTo({ path: "/sign-in", query: { callbackURL: to.fullPath } });
  }
});
