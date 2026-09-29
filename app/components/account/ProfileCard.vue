<script setup lang="ts">
import { toast } from "vue-sonner";
import { authClient } from "~/lib/auth-client";
import { errorMessage } from "~/lib/errors";

const session = authClient.useSession();
const name = ref(session.value.data?.user.name ?? "");
const loading = ref(false);

async function save() {
  loading.value = true;
  const res = await authClient.updateUser({ name: name.value });
  loading.value = false;
  if (res.error) return toast.error(errorMessage(res.error));
  toast.success("Profil enregistré.");
}
</script>

<template>
  <Card>
    <CardHeader><CardTitle>Profil</CardTitle></CardHeader>
    <CardContent>
      <form class="grid gap-4 sm:max-w-md" @submit.prevent="save">
        <FormField :model-value="session.data?.user.email ?? ''" label="Email" disabled />
        <FormField v-model="name" label="Nom" required />
        <div><Button type="submit" :disabled="loading">Enregistrer</Button></div>
      </form>
    </CardContent>
  </Card>
</template>
