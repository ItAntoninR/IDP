<script setup lang="ts">
import { ShieldCheck } from "lucide-vue-next";
import { authClient, isGlobalAdmin } from "~/lib/auth-client";

definePageMeta({ middleware: "auth" });
useHead({ title: "Sécurité" });

const session = authClient.useSession();
const { accounts, hasPassword } = useLinkedAccounts();
const isAdmin = computed(() => isGlobalAdmin(session.value.data?.user));
</script>

<template>
  <PageLoader v-if="!session.data || !accounts" />
  <template v-else>
    <PageHeader title="Sécurité" description="Mot de passe, passkeys et double authentification." />
    <div v-if="isAdmin" class="bg-card flex items-start gap-3 rounded-xl border p-5 shadow-sm">
      <span class="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg"><ShieldCheck class="size-4" /></span>
      <div class="space-y-1">
        <p class="font-medium">Votre connexion est gérée par Authentik</p>
        <p class="text-muted-foreground text-sm">
          Mot de passe et double authentification se configurent dans Authentik. L'application refuse toute connexion d'équipe sans second facteur.
        </p>
      </div>
    </div>
    <template v-else>
      <AccountPasswordCard :has-password="hasPassword" :email="session.data.user.email" />
      <AccountPasskeysCard />
      <AccountTwoFactorCard :has-password="hasPassword" />
    </template>
  </template>
</template>
