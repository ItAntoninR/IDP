<script setup lang="ts">
import { authClient, impersonatorOf } from "~/lib/auth-client";

const session = authClient.useSession();
const stopping = ref(false);

const impersonating = computed(() => Boolean(session.value.data && impersonatorOf(session.value.data.session)));

async function stop() {
  stopping.value = true;
  await authClient.admin.stopImpersonating();
  window.location.href = "/admin/users";
}
</script>

<template>
  <div
    v-if="impersonating"
    class="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-3 bg-amber-400 px-4 py-2 text-sm font-medium text-amber-950"
  >
    <span>Vous agissez en tant que {{ session.data?.user.name || session.data?.user.email }}</span>
    <span aria-hidden="true">—</span>
    <button class="underline underline-offset-2 hover:no-underline" :disabled="stopping" @click="stop">Arrêter</button>
  </div>
</template>
