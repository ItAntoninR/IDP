import { authClient } from "~/lib/auth-client";
import type { LinkedAccount } from "~/lib/types";

export function useLinkedAccounts() {
  const accounts = ref<LinkedAccount[] | null>(null);
  const hasPassword = computed(() => accounts.value?.some((a) => a.providerId === "credential") ?? false);

  async function load() {
    const res = await authClient.listAccounts();

    accounts.value = (res.data ?? []) as unknown as LinkedAccount[];
  }

  onMounted(load);

  return { accounts, hasPassword, load };
}
