<script setup lang="ts">
import { authClient } from "~/lib/auth-client";
import { errorMessage, urlErrorMessage } from "~/lib/errors";

definePageMeta({ layout: "auth" });
useHead({ title: "Nouveau mot de passe" });

const route = useRoute();
const token = typeof route.query.token === "string" ? route.query.token : null;
const password = ref("");
const confirm = ref("");
const error = ref(urlErrorMessage(route.query.error) || (token ? "" : urlErrorMessage("INVALID_TOKEN")));
const done = ref(false);
const loading = ref(false);

async function submit() {
  if (password.value !== confirm.value) return (error.value = "Les deux mots de passe ne correspondent pas.");
  error.value = "";
  loading.value = true;
  const res = await authClient.resetPassword({ newPassword: password.value, token: token! });
  loading.value = false;
  if (res.error) return (error.value = errorMessage(res.error));
  done.value = true;
}
</script>

<template>
  <AuthCard title="Nouveau mot de passe">
    <template v-if="done">
      <FormAlert tone="success" message="Votre mot de passe a été modifié. Toutes vos sessions ont été fermées." />
      <Button as-child class="w-full"><NuxtLink to="/sign-in">Se connecter</NuxtLink></Button>
    </template>
    <template v-else-if="!token">
      <FormAlert :message="error" />
      <NuxtLink to="/forgot-password" class="text-muted-foreground block text-center text-sm hover:underline">
        Demander un nouveau lien
      </NuxtLink>
    </template>
    <form v-else class="space-y-4" @submit.prevent="submit">
      <FormAlert :message="error" />
      <FormField
        v-model="password"
        label="Nouveau mot de passe"
        type="password"
        autocomplete="new-password"
        :minlength="10"
        required
        hint="10 caractères minimum."
      />
      <FormField v-model="confirm" label="Confirmation" type="password" autocomplete="new-password" :minlength="10" required />
      <Button type="submit" class="w-full" :disabled="loading">Enregistrer</Button>
    </form>
  </AuthCard>
</template>
