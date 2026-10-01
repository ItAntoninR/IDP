<script setup lang="ts">
import { authClient } from "~/lib/auth-client";
import { errorMessage } from "~/lib/errors";

definePageMeta({ layout: "auth", middleware: "auth" });
useHead({ title: "Suppression du compte" });

const route = useRoute();
const token = typeof route.query.token === "string" ? route.query.token : "";
const session = authClient.useSession();
const { clear } = useAccountContext();
const deleting = ref(false);
const deleted = ref(false);
const error = ref(token ? "" : errorMessage({ code: "INVALID_TOKEN" }));

async function confirmDeletion() {
  error.value = "";
  deleting.value = true;
  try {
    await $fetch("/api/account/deletion/confirm", { method: "POST", body: { token } });
  } catch (e) {
    return (error.value = errorMessage((e as { data?: unknown }).data ?? e));
  } finally {
    deleting.value = false;
  }

  await authClient.signOut().catch(() => undefined);
  clear();
  clearNuxtState((key) => key.startsWith("managed-org"));
  deleted.value = true;
}
</script>

<template>
  <AuthCard
    v-if="deleted"
    title="Compte supprimé"
    description="Vos accès et vos informations personnelles ont été effacés."
  >
    <FormAlert
      tone="success"
      message="Un email de confirmation vous a été envoyé."
    />

    <Button
      as-child
      variant="outline"
      class="w-full"
    >
      <NuxtLink to="/sign-in">Retour à la connexion</NuxtLink>
    </Button>
  </AuthCard>

  <AuthCard
    v-else
    title="Supprimer votre compte"
    :description="session.data ? `Compte : ${session.data.user.email}` : undefined"
  >
    <FormAlert :message="error" />

    <p class="text-muted-foreground text-sm">
      La suppression est définitive : vous perdrez l'accès à toutes vos applications et vos informations personnelles
      seront effacées. Votre identité et votre historique de connexion seront conservés 1 an dans une archive,
      uniquement pour répondre aux autorités.
    </p>

    <Button
      variant="destructive"
      class="w-full"
      :disabled="deleting || !token"
      @click="confirmDeletion"
    >
      Supprimer définitivement mon compte
    </Button>

    <Button
      as-child
      variant="ghost"
      class="w-full"
    >
      <NuxtLink to="/account">Annuler</NuxtLink>
    </Button>
  </AuthCard>
</template>
