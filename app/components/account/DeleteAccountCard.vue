<script setup lang="ts">
import { toast } from "vue-sonner";
import { Trash2 } from "lucide-vue-next";
import { errorMessage } from "~/lib/errors";

type Blocker = { code: "STAFF_ACCOUNT_MANAGED_IN_AUTHENTIK" } | { code: "SOLE_OWNER"; organizations: string[] } | null;

const blocker = ref<Blocker | undefined>(undefined);
const confirmOpen = ref(false);
const sending = ref(false);
const sent = ref(false);

async function load() {
  blocker.value = (await $fetch<{ blocker: Blocker }>("/api/account/deletion").catch(() => ({ blocker: null }))).blocker;
}

async function requestDeletion() {
  sending.value = true;
  try {
    await $fetch("/api/account/deletion", { method: "POST" });
  } catch (e) {
    toast.error(errorMessage((e as { data?: unknown }).data ?? e));
    return load();
  } finally {
    sending.value = false;
  }
  confirmOpen.value = false;
  sent.value = true;
}

onMounted(load);
</script>

<template>
  <Card v-if="blocker?.code !== 'STAFF_ACCOUNT_MANAGED_IN_AUTHENTIK'">
    <CardHeader>
      <CardTitle>Supprimer mon compte</CardTitle>
      <CardDescription>Vos accès aux applications et vos informations personnelles seront définitivement effacés.</CardDescription>
    </CardHeader>
    <CardContent class="space-y-3">
      <FormAlert v-if="sent" tone="success" message="Un email de confirmation vient de vous être envoyé. Le lien est valable 1 heure." />
      <FormAlert
        v-else-if="blocker?.code === 'SOLE_OWNER'"
        tone="info"
        :message="`Vous êtes le seul gérant de : ${blocker.organizations.join(', ')}. Transférez d'abord ce rôle à un autre membre depuis la page Personnes, ou demandez à notre équipe de supprimer l'organisation.`"
      />
      <Button variant="destructive" :disabled="blocker === undefined || !!blocker || sent" @click="confirmOpen = true">
        <Trash2 /> Supprimer mon compte
      </Button>
    </CardContent>
  </Card>

  <ConfirmDialog
    v-model:open="confirmOpen"
    title="Supprimer votre compte ?"
    description="Nous allons vous envoyer un email pour confirmer. La suppression ne sera faite qu'après avoir cliqué sur le lien, et elle sera définitive. Votre identité et votre historique de connexion seront conservés 1 an dans une archive, uniquement pour répondre aux autorités."
    confirm-label="Envoyer l'email de confirmation"
    destructive
    :loading="sending"
    @confirm="requestDeletion"
  />
</template>
