<script setup lang="ts">
import { KeyRound, RefreshCw, ShieldCheck, ShieldOff } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { authClient } from "~/lib/auth-client";
import { errorMessage } from "~/lib/errors";

const props = defineProps<{ hasPassword: boolean }>();

const { context, load, refresh } = useAccountContext();

onMounted(() => load().catch(() => undefined));
const enabled = computed(() => context.value?.twoFactor.totp ?? false);
const requiredBy = computed(() => context.value?.twoFactor.requiredBy ?? []);

const setupOpen = ref(false);
const action = ref<"disable" | "codes" | null>(null);
const actionOpen = ref(false);
const password = ref("");
const newCodes = ref<string[]>([]);
const loading = ref(false);

function ask(kind: "disable" | "codes") {
  action.value = kind;
  password.value = "";
  newCodes.value = [];
  actionOpen.value = true;
}

async function onSetupDone() {
  setupOpen.value = false;
  await refresh();
}

async function confirmAction() {
  loading.value = true;
  const body = props.hasPassword ? { password: password.value } : {};
  const res =
    action.value === "disable"
      ? await authClient.twoFactor.disable(body as { password: string })
      : await authClient.twoFactor.generateBackupCodes(body as { password: string });

  loading.value = false;
  if (res.error) return toast.error(errorMessage(res.error));
  if (action.value === "disable") {
    toast.success("Double authentification désactivée.");
    actionOpen.value = false;
    await refresh();
  } else {
    newCodes.value = (res.data as unknown as { backupCodes: string[] }).backupCodes;
  }
}
</script>

<template>
  <div>
    <Card>
      <CardHeader>
        <CardTitle>Double authentification</CardTitle>

        <CardDescription>Un code de votre téléphone vous est demandé en plus du mot de passe.</CardDescription>
      </CardHeader>

      <CardContent class="space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
          <div class="flex items-center gap-3">
            <span
              class="flex size-9 items-center justify-center rounded-lg"
              :class="enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-muted'"
            >
              <component
                :is="enabled ? ShieldCheck : KeyRound"
                class="size-4"
              />
            </span>

            <div>
              <p class="text-sm font-medium">Application d'authentification</p>

              <p class="text-muted-foreground text-xs">{{ enabled ? "Activée" : "Non activée" }}</p>
            </div>
          </div>

          <div class="flex flex-wrap gap-2">
            <template v-if="enabled">
              <Button
                variant="outline"
                size="sm"
                @click="ask('codes')"
              >
                <RefreshCw />
                Nouveaux codes de secours
              </Button>

              <Button
                v-if="!requiredBy.length || context?.twoFactor.passkey"
                variant="outline"
                size="sm"
                @click="ask('disable')"
              >
                <ShieldOff />
                Désactiver
              </Button>
            </template>

            <Button
              v-else
              size="sm"
              @click="setupOpen = true"
            >
              <ShieldCheck />
              Activer
            </Button>
          </div>
        </div>

        <p
          v-if="requiredBy.length && !context?.twoFactor.passkey"
          class="text-muted-foreground text-xs"
        >
          Obligatoire pour {{ requiredBy.map((o) => o.name).join(", ") }} : ajoutez une passkey si vous voulez pouvoir
          la désactiver.
        </p>
      </CardContent>
    </Card>

    <Dialog v-model:open="setupOpen">
      <DialogContent class="max-w-xl">
        <DialogHeader>
          <DialogTitle>Activer la double authentification</DialogTitle>

          <DialogDescription>
            Quelques secondes suffisent avec une application d'authentification sur votre téléphone.
          </DialogDescription>
        </DialogHeader>

        <AccountTwoFactorSetup
          v-if="setupOpen"
          :has-password="hasPassword"
          @done="onSetupDone"
        />
      </DialogContent>
    </Dialog>

    <ConfirmDialog
      v-model:open="actionOpen"
      :title="
        action === 'disable' ? 'Désactiver la double authentification ?' : 'Générer de nouveaux codes de secours ?'
      "
      :description="
        action === 'disable'
          ? 'Votre compte ne sera plus protégé que par votre mot de passe.'
          : 'Les anciens codes ne fonctionneront plus.'
      "
      :confirm-label="newCodes.length ? 'Fermer' : action === 'disable' ? 'Désactiver' : 'Générer'"
      :destructive="action === 'disable'"
      :loading="loading"
      @confirm="newCodes.length ? (actionOpen = false) : confirmAction()"
    >
      <div
        v-if="newCodes.length"
        class="bg-muted grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg p-4 font-mono text-sm"
      >
        <span
          v-for="c in newCodes"
          :key="c"
        >
          {{ c }}
        </span>
      </div>

      <FormField
        v-else-if="hasPassword"
        v-model="password"
        label="Mot de passe"
        type="password"
        autocomplete="current-password"
      />
    </ConfirmDialog>
  </div>
</template>
