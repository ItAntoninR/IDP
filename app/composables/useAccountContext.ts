import { authClient } from "~/lib/auth-client";
import type { MyOrganization } from "~/lib/api";

export interface AccountContext {
  impersonating: boolean;
  twoFactor: { enabled: boolean; totp: boolean; passkey: boolean; requiredBy: { id: string; name: string }[] };
  organizations: MyOrganization[];
  active: (MyOrganization & { canManage: boolean }) | null;
}

export function useAccountContext() {
  const context = useState<AccountContext | null>("account-context", () => null);

  async function refresh() {
    context.value = await $fetch<AccountContext>("/api/account/context");

    return context.value;
  }

  const load = () => (context.value ? Promise.resolve(context.value) : refresh());

  async function switchOrganization(organizationId: string) {
    const res = await authClient.organization.setActive({ organizationId });

    if (res.error) throw res.error;

    return refresh();
  }

  const clear = () => (context.value = null);

  async function signOut() {
    await authClient.signOut();
    clear();
    clearNuxtState((key) => key.startsWith("managed-org"));
    await navigateTo("/sign-in", { replace: true });
  }

  return { context, load, refresh, switchOrganization, clear, signOut };
}
