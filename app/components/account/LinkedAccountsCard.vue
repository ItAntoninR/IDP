<script setup lang="ts">
import type { Component } from "vue";
import { toast } from "vue-sonner";
import { GoogleIcon, MicrosoftIcon } from "#components";
import { authClient } from "~/lib/auth-client";
import { errorMessage, urlErrorMessage } from "~/lib/errors";
import { getPublicConfig } from "~/lib/api";
import { formatDate } from "~/lib/labels";
import type { LinkedAccount } from "~/lib/types";

type Provider = "google" | "microsoft";

const props = defineProps<{ accounts: LinkedAccount[] }>();
const emit = defineEmits<{ changed: [] }>();

const route = useRoute();
const error = ref(urlErrorMessage(route.query.error));
const enabled = ref<Record<Provider, boolean>>({ google: false, microsoft: false });
const busy = ref<Provider | null>(null);
const target = ref<Provider | null>(null);
const unlinkOpen = ref(false);

const PROVIDERS: { id: Provider; label: string; icon: Component }[] = [
  { id: "microsoft", label: "Microsoft", icon: MicrosoftIcon },
  { id: "google", label: "Google", icon: GoogleIcon },
];

const linked = (id: string) => props.accounts.find((a) => a.providerId === id);
const authentik = computed(() => linked("authentik"));
const visible = computed(() => PROVIDERS);
const signInMethods = computed(() => props.accounts.length);

onMounted(() => {
  getPublicConfig()
    .then((c) => (enabled.value = { google: c.googleEnabled, microsoft: c.microsoftEnabled }))
    .catch(() => undefined);
});

async function link(provider: Provider) {
  busy.value = provider;
  const res = await authClient.linkSocial({ provider, callbackURL: "/account", errorCallbackURL: "/account" });
  if (res.error) {
    busy.value = null;
    toast.error(errorMessage(res.error));
  }
}

function askUnlink(provider: Provider) {
  target.value = provider;
  unlinkOpen.value = true;
}

async function unlink() {
  const provider = target.value;
  const account = provider ? linked(provider) : undefined;
  if (!provider || !account) return;
  busy.value = provider;
  const res = await authClient.unlinkAccount({ accountId: account.id });
  busy.value = null;
  if (res.error) return toast.error(errorMessage(res.error));
  unlinkOpen.value = false;
  toast.success(`Compte ${PROVIDERS.find((p) => p.id === provider)?.label} délié.`);
  emit("changed");
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Comptes liés</CardTitle>
      <CardDescription>Connectez-vous avec le compte de votre entreprise. L'adresse email doit être la même.</CardDescription>
    </CardHeader>
    <CardContent class="space-y-3">
      <FormAlert :message="error" />
      <ul class="divide-y rounded-lg border">
        <li v-if="authentik" class="flex items-center gap-3 px-4 py-3">
          <AuthentikIcon />
          <div class="flex-1">
            <p class="text-sm font-medium">Authentik</p>
            <p class="text-muted-foreground text-xs">Lié le {{ formatDate(authentik.createdAt) }}</p>
          </div>
        </li>
        <li v-for="p in visible" :key="p.id" class="flex flex-wrap items-center gap-3 px-4 py-3">
          <component :is="p.icon" />
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium">{{ p.label }}</p>
            <p class="text-muted-foreground text-xs">
              {{ linked(p.id) ? `Lié le ${formatDate(linked(p.id)!.createdAt)}` : enabled[p.id] ? "Non lié" : "Pas encore configuré sur ce service" }}
            </p>
          </div>
          <Button
            v-if="linked(p.id)"
            variant="outline"
            size="sm"
            :disabled="busy !== null || signInMethods < 2"
            :title="signInMethods < 2 ? 'C\'est votre seul moyen de connexion' : undefined"
            @click="askUnlink(p.id)"
          >
            Délier
          </Button>
          <Button v-else variant="outline" size="sm" :disabled="busy !== null || !enabled[p.id]" @click="link(p.id)">
            <component :is="p.icon" /> Lier
          </Button>
        </li>
      </ul>
      <p v-if="!authentik && !visible.length" class="text-muted-foreground text-sm">Aucun fournisseur externe n'est activé sur ce service.</p>
    </CardContent>
  </Card>

  <ConfirmDialog
    v-model:open="unlinkOpen"
    :title="`Délier votre compte ${PROVIDERS.find((p) => p.id === target)?.label ?? ''} ?`"
    description="Vous ne pourrez plus vous connecter avec ce compte. Vos autres moyens de connexion restent actifs."
    confirm-label="Délier"
    destructive
    :loading="busy !== null"
    @confirm="unlink"
  />
</template>
