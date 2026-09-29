<script setup lang="ts">
import { Cloud, Fingerprint, LoaderCircle, Plus, Trash2 } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { authClient } from "~/lib/auth-client";
import { errorMessage } from "~/lib/errors";
import { formatDate } from "~/lib/labels";

interface PasskeyRow {
  id: string;
  name?: string | null;
  createdAt?: string | Date | null;
  backedUp: boolean;
  deviceType: string;
}

const emit = defineEmits<{ changed: [] }>();

const { refresh } = useAccountContext();
const passkeys = ref<PasskeyRow[] | null>(null);
const supported = ref(true);
const adding = ref(false);
const target = ref<PasskeyRow | null>(null);
const deleteOpen = ref(false);
const deleting = ref(false);

function defaultName() {
  const ua = navigator.userAgent;
  const device = /iPhone|iPad/.test(ua)
    ? "iPhone"
    : /Android/.test(ua)
      ? "Android"
      : /Mac/.test(ua)
        ? "Mac"
        : /Windows/.test(ua)
          ? "Windows"
          : "Appareil";
  return `${device} · ${new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date())}`;
}

async function load() {
  const res = await authClient.passkey.listUserPasskeys();
  passkeys.value = (res.data ?? []) as unknown as PasskeyRow[];
}

async function add() {
  adding.value = true;
  const res = await authClient.passkey.addPasskey({ name: defaultName() });
  adding.value = false;
  if (res?.error) {
    if ((res.error as { code?: string }).code !== "AUTH_CANCELLED") toast.error(errorMessage(res.error));
    return;
  }
  toast.success("Passkey ajoutée.");
  await Promise.all([load(), refresh()]);
  emit("changed");
}

function askDelete(p: PasskeyRow) {
  target.value = p;
  deleteOpen.value = true;
}

async function remove() {
  const p = target.value;
  if (!p) return;
  deleting.value = true;
  const res = await authClient.passkey.deletePasskey({ id: p.id });
  deleting.value = false;
  if (res.error) return toast.error(errorMessage(res.error));
  deleteOpen.value = false;
  toast.success("Passkey supprimée.");
  await Promise.all([load(), refresh()]);
  emit("changed");
}

onMounted(() => {
  supported.value = typeof window.PublicKeyCredential !== "undefined";
  load();
});
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Passkeys</CardTitle>
      <CardDescription>Connectez-vous avec votre empreinte, votre visage ou le code de votre appareil, sans mot de passe.</CardDescription>
      <CardAction>
        <Button size="sm" variant="outline" :disabled="adding || !supported" @click="add">
          <LoaderCircle v-if="adding" class="animate-spin" />
          <Plus v-else />
          Ajouter
        </Button>
      </CardAction>
    </CardHeader>
    <CardContent class="space-y-3">
      <PageLoader v-if="!passkeys" />
      <div v-else-if="!passkeys.length" class="flex items-center gap-3 rounded-lg border border-dashed px-4 py-4">
        <span class="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg"><Fingerprint class="size-4" /></span>
        <p class="text-muted-foreground text-sm">
          {{ supported ? "Aucune passkey. Ajoutez-en une pour vous connecter en un geste : elle compte aussi comme double authentification." : "Ce navigateur ne prend pas en charge les passkeys." }}
        </p>
      </div>
      <ul v-else class="divide-y rounded-lg border">
        <li v-for="p in passkeys" :key="p.id" class="flex items-center gap-3 px-4 py-3">
          <span class="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg"><Fingerprint class="size-4" /></span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium">{{ p.name || "Passkey" }}</p>
            <p class="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs">
              <span>Ajoutée le {{ formatDate(p.createdAt ?? null) }}</span>
              <span v-if="p.backedUp" class="inline-flex items-center gap-1">· <Cloud class="size-3" /> synchronisée</span>
            </p>
          </div>
          <Button variant="ghost" size="icon" class="size-8" :aria-label="`Supprimer ${p.name || 'la passkey'}`" @click="askDelete(p)">
            <Trash2 />
          </Button>
        </li>
      </ul>
    </CardContent>
  </Card>

  <ConfirmDialog
    v-model:open="deleteOpen"
    :title="`Supprimer « ${target?.name || 'cette passkey'} » ?`"
    description="Vous ne pourrez plus vous connecter avec cet appareil. Pensez à la retirer aussi du gestionnaire de mots de passe de l'appareil."
    confirm-label="Supprimer"
    destructive
    :loading="deleting"
    @confirm="remove"
  />
</template>
