<script setup lang="ts">
import { Fingerprint, LoaderCircle, Smartphone } from "lucide-vue-next";
import { errorMessage } from "~/lib/errors";
import { authClient } from "~/lib/auth-client";
import { goTo, safeRedirect } from "~/lib/oauth";
import type { LinkedAccount } from "~/lib/types";

definePageMeta({ layout: "auth", middleware: "auth" });
useHead({ title: "Activer la double authentification" });

const route = useRoute();
const { context, refresh, signOut } = useAccountContext();
const hasPassword = ref<boolean | null>(null);
const method = ref<"choose" | "totp">("choose");
const passkeySupported = ref(false);
const adding = ref(false);
const error = ref("");

async function addPasskey() {
  error.value = "";
  adding.value = true;
  const res = await authClient.passkey.addPasskey({ name: `Passkey · ${new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date())}` });
  adding.value = false;
  if (res?.error) {
    if ((res.error as { code?: string }).code !== "AUTH_CANCELLED") error.value = errorMessage(res.error);
    return;
  }
  await done();
}

const organizations = computed(() => context.value?.twoFactor.requiredBy.map((o) => o.name).join(", ") ?? "");

onMounted(async () => {
  passkeySupported.value = typeof window.PublicKeyCredential !== "undefined";
  const res = await authClient.listAccounts();
  hasPassword.value = ((res.data ?? []) as unknown as LinkedAccount[]).some((a) => a.providerId === "credential");
});

async function done() {
  await refresh();
  await goTo(safeRedirect(route.query.callbackURL, "/"));
}
</script>

<template>
  <AuthCard
    title="Activez la double authentification"
    :description="`${organizations} exige un second facteur pour protéger ses données. C'est l'affaire d'une minute.`"
  >
    <FormAlert :message="error" />
    <PageLoader v-if="hasPassword === null" />
    <div v-else-if="method === 'choose'" class="space-y-2">
      <button
        v-if="passkeySupported"
        type="button"
        class="hover:border-foreground/20 hover:bg-accent/50 flex w-full cursor-pointer items-center gap-3 rounded-lg border p-4 text-left transition-colors disabled:opacity-60"
        :disabled="adding"
        @click="addPasskey"
      >
        <span class="bg-brand text-brand-foreground flex size-10 shrink-0 items-center justify-center rounded-lg">
          <LoaderCircle v-if="adding" class="size-5 animate-spin" />
          <Fingerprint v-else class="size-5" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="flex items-center gap-2 font-medium">Passkey <Badge variant="secondary">Recommandé</Badge></span>
          <span class="text-muted-foreground text-xs">Empreinte, visage ou code de cet appareil. Rien à recopier.</span>
        </span>
      </button>
      <button
        type="button"
        class="hover:border-foreground/20 hover:bg-accent/50 flex w-full cursor-pointer items-center gap-3 rounded-lg border p-4 text-left transition-colors"
        @click="method = 'totp'"
      >
        <span class="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg"><Smartphone class="size-5" /></span>
        <span class="min-w-0 flex-1">
          <span class="block font-medium">Application d'authentification</span>
          <span class="text-muted-foreground text-xs">Google Authenticator, Microsoft Authenticator… Un code à 6 chiffres.</span>
        </span>
      </button>
    </div>
    <template v-else>
      <AccountTwoFactorSetup :has-password="hasPassword" @done="done" />
      <button type="button" class="text-muted-foreground cursor-pointer text-sm hover:underline" @click="method = 'choose'">← Choisir une autre méthode</button>
    </template>
    <button type="button" class="text-muted-foreground cursor-pointer text-sm hover:underline" @click="signOut">Se déconnecter</button>
  </AuthCard>
</template>
