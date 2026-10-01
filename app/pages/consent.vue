<script setup lang="ts">
import { authClient } from "~/lib/auth-client";
import { errorMessage } from "~/lib/errors";

definePageMeta({ layout: "auth", middleware: "auth" });
useHead({ title: "Autoriser l'accès" });

const route = useRoute();
const scopes = (typeof route.query.scope === "string" ? route.query.scope : "").split(" ").filter(Boolean);
const labels: Record<string, string> = {
  openid: "Vous identifier",
  profile: "Voir votre nom",
  email: "Voir votre adresse email",
  offline_access: "Rester connecté",
};
const error = ref("");
const loading = ref(false);

async function decide(accept: boolean) {
  loading.value = true;
  const res = await authClient.$fetch<{ url?: string; redirect?: boolean }>("/oauth2/consent", {
    method: "POST",
    body: { accept, oauth_query: window.location.search.slice(1) },
  });

  loading.value = false;
  if (res.error) return (error.value = errorMessage(res.error));
  if (res.data?.url && !res.data.redirect) window.location.href = res.data.url;
}
</script>

<template>
  <AuthCard
    title="Autoriser l'accès"
    description="Une application demande à accéder à votre compte."
  >
    <FormAlert :message="error" />

    <ul class="list-inside list-disc text-sm">
      <li
        v-for="s in scopes"
        :key="s"
      >
        {{ labels[s] ?? s }}
      </li>
    </ul>

    <div class="grid gap-2 sm:grid-cols-2">
      <Button
        :disabled="loading"
        @click="decide(true)"
      >
        Autoriser
      </Button>

      <Button
        variant="outline"
        :disabled="loading"
        @click="decide(false)"
      >
        Refuser
      </Button>
    </div>
  </AuthCard>
</template>
