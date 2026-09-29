<script setup lang="ts">
import { authClient } from "~/lib/auth-client";
import { errorMessage } from "~/lib/errors";

definePageMeta({ layout: "auth" });
useHead({ title: "Mot de passe oublié" });

const route = useRoute();
const email = ref(typeof route.query.email === "string" ? route.query.email : "");
const sent = ref(false);
const error = ref("");
const loading = ref(false);

async function submit() {
  error.value = "";
  loading.value = true;
  const res = await authClient.requestPasswordReset({ email: email.value, redirectTo: "/reset-password" });
  loading.value = false;
  if (res.error) return (error.value = errorMessage(res.error));
  sent.value = true;
}
</script>

<template>
  <AuthCard title="Mot de passe oublié" description="Nous vous envoyons un lien pour en choisir un nouveau.">
    <FormAlert v-if="sent" tone="success" :message="`Si un compte correspond à ${email}, un email de réinitialisation vient d'être envoyé.`" />
    <form v-else class="space-y-4" @submit.prevent="submit">
      <FormAlert :message="error" />
      <FormField v-model="email" label="Email" type="email" autocomplete="email" required />
      <Button type="submit" class="w-full" :disabled="loading">Envoyer le lien</Button>
    </form>
    <NuxtLink to="/sign-in" class="text-muted-foreground block text-center text-sm hover:underline">Retour à la connexion</NuxtLink>
  </AuthCard>
</template>
