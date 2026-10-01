<script setup lang="ts">
import { authClient } from "~/lib/auth-client";
import { errorMessage, urlErrorMessage } from "~/lib/errors";
import { safeRedirect } from "~/lib/oauth";

definePageMeta({ layout: "auth" });
useHead({ title: "Confirmation de l'adresse email" });

const route = useRoute();
const failed = urlErrorMessage(route.query.error);
const next = safeRedirect(route.query.next, "/");
const email = ref("");
const sent = ref(false);
const sendError = ref("");

async function resend() {
  sendError.value = "";
  const res = await authClient.sendVerificationEmail({ email: email.value, callbackURL: "/verify-email" });

  if (res.error) return (sendError.value = errorMessage(res.error));
  sent.value = true;
}
</script>

<template>
  <AuthCard
    v-if="!failed"
    title="Adresse confirmée"
  >
    <FormAlert
      tone="success"
      message="Merci, votre adresse email est confirmée."
    />

    <Button
      as-child
      class="w-full"
    >
      <NuxtLink :to="next">Continuer</NuxtLink>
    </Button>
  </AuthCard>

  <AuthCard
    v-else
    title="Confirmation impossible"
  >
    <FormAlert :message="failed" />

    <FormAlert
      v-if="sent"
      tone="success"
      message="Un nouveau lien vient d'être envoyé."
    />

    <form
      v-else
      class="space-y-3"
      @submit.prevent="resend"
    >
      <FormAlert :message="sendError" />

      <FormField
        v-model="email"
        label="Email"
        type="email"
        required
      />

      <Button
        type="submit"
        variant="outline"
        class="w-full"
      >
        Renvoyer un lien
      </Button>
    </form>
  </AuthCard>
</template>
