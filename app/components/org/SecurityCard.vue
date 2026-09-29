<script setup lang="ts">
import { toast } from "vue-sonner";
import { authClient } from "~/lib/auth-client";
import { errorMessage } from "~/lib/errors";
import type { FullOrganization } from "~/lib/org";

const props = defineProps<{ org: FullOrganization; stats?: { members: number; twoFactorEnabled: number } | null }>();
const emit = defineEmits<{ changed: [] }>();

const { refresh } = useAccountContext();
const confirmOpen = ref(false);
const saving = ref(false);
const required = computed(() => props.org.requireTwoFactor === true);
const coverage = computed(() =>
  props.stats && props.stats.members ? Math.round((props.stats.twoFactorEnabled / props.stats.members) * 100) : 0,
);

async function save(value: boolean) {
  saving.value = true;
  const res = await authClient.organization.update({ organizationId: props.org.id, data: { requireTwoFactor: value } });
  saving.value = false;
  confirmOpen.value = false;
  if (res.error) return toast.error(errorMessage(res.error));
  toast.success(value ? "Double authentification obligatoire." : "Double authentification facultative.");
  emit("changed");
  await refresh();
}

function toggle(value: boolean) {
  if (value) confirmOpen.value = true;
  else save(false);
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Sécurité</CardTitle>
      <CardDescription>Règles de connexion appliquées à tous les membres de l'organisation.</CardDescription>
    </CardHeader>
    <CardContent>
      <div class="flex items-center justify-between gap-6 rounded-lg border px-4 py-3">
        <div>
          <p class="text-sm font-medium">Exiger la double authentification</p>
          <p class="text-muted-foreground text-xs">
            Chaque membre devra activer une application d'authentification pour accéder à vos applications.
          </p>
        </div>
        <Switch :model-value="required" :disabled="saving" aria-label="Exiger la double authentification" @update:model-value="toggle" />
      </div>
      <div v-if="stats" class="mt-4 space-y-2 rounded-lg border px-4 py-3">
        <div class="flex items-center justify-between text-sm">
          <span class="font-medium">Membres protégés</span>
          <span class="text-muted-foreground tabular-nums">{{ stats.twoFactorEnabled }} sur {{ stats.members }} · {{ coverage }} %</span>
        </div>
        <div class="bg-muted h-2 overflow-hidden rounded-full">
          <div class="h-full rounded-full bg-emerald-500 transition-all" :style="{ width: `${coverage}%` }" />
        </div>
        <p v-if="required && stats.twoFactorEnabled < stats.members" class="text-xs text-amber-700">
          Les membres sans 2FA devront l'activer à leur prochaine connexion.
        </p>
      </div>
    </CardContent>
  </Card>

  <ConfirmDialog
    v-model:open="confirmOpen"
    title="Exiger la double authentification ?"
    description="Les membres qui ne l'ont pas encore activée devront le faire à leur prochaine visite, et n'obtiendront plus d'accès aux applications d'ici là. Si vous ne l'avez pas encore activée, vous devrez le faire aussi."
    confirm-label="Exiger"
    :loading="saving"
    @confirm="save(true)"
  />
</template>
