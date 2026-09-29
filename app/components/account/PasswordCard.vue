<script setup lang="ts">
import { toast } from "vue-sonner";
import { authClient } from "~/lib/auth-client";
import { errorMessage } from "~/lib/errors";

const props = defineProps<{ hasPassword: boolean; email: string }>();

const current = ref("");
const next = ref("");
const loading = ref(false);

async function change() {
  loading.value = true;
  const res = await authClient.changePassword({
    currentPassword: current.value,
    newPassword: next.value,
    revokeOtherSessions: true,
  });
  loading.value = false;
  if (res.error) return toast.error(errorMessage(res.error));
  current.value = "";
  next.value = "";
  toast.success("Mot de passe modifié. Vos autres sessions ont été fermées.");
}

async function requestLink() {
  loading.value = true;
  const res = await authClient.requestPasswordReset({ email: props.email, redirectTo: "/reset-password" });
  loading.value = false;
  if (res.error) return toast.error(errorMessage(res.error));
  toast.success("Un lien pour définir votre mot de passe vient de vous être envoyé.");
}
</script>

<template>
  <Card>
    <CardHeader><CardTitle>Mot de passe</CardTitle></CardHeader>
    <CardContent>
      <form v-if="hasPassword" class="grid gap-4 sm:max-w-md" @submit.prevent="change">
        <FormField v-model="current" label="Mot de passe actuel" type="password" autocomplete="current-password" required />
        <FormField
          v-model="next"
          label="Nouveau mot de passe"
          type="password"
          autocomplete="new-password"
          :minlength="10"
          required
          hint="10 caractères minimum."
        />
        <div><Button type="submit" :disabled="loading">Modifier</Button></div>
      </form>
      <div v-else class="text-muted-foreground space-y-3 text-sm">
        <p>Vous vous connectez sans mot de passe. Vous pouvez en définir un par email.</p>
        <Button variant="outline" :disabled="loading" @click="requestLink">Définir un mot de passe</Button>
      </div>
    </CardContent>
  </Card>
</template>
