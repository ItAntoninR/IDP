<script setup lang="ts">
import { toast } from "vue-sonner";
import { LogOut } from "lucide-vue-next";
import { authClient } from "~/lib/auth-client";
import { errorMessage } from "~/lib/errors";
import { roleLabel } from "~/lib/labels";
import type { MyOrganization } from "~/lib/api";

const { context, load, refresh } = useAccountContext();
const target = ref<MyOrganization | null>(null);
const confirmOpen = ref(false);
const leaving = ref(false);

const isOwner = (org: MyOrganization) => org.role.split(",").includes("owner");

function askLeave(org: MyOrganization) {
  target.value = org;
  confirmOpen.value = true;
}

async function leave() {
  const org = target.value;
  if (!org) return;
  leaving.value = true;
  const res = await authClient.organization.leave({ organizationId: org.id });
  leaving.value = false;
  if (res.error) return toast.error(errorMessage(res.error));
  confirmOpen.value = false;
  clearNuxtState((key) => key.startsWith("managed-org"));
  await refresh();
  toast.success(`Vous avez quitté ${org.name}.`);
}

onMounted(load);
</script>

<template>
  <Card v-if="context && context.organizations.length">
    <CardHeader>
      <CardTitle>Organisations</CardTitle>
      <CardDescription>Les organisations dont vous êtes membre.</CardDescription>
    </CardHeader>
    <CardContent>
      <ul class="divide-y rounded-lg border">
        <li v-for="org in context.organizations" :key="org.id" class="flex items-center gap-3 px-3 py-2.5">
          <OrgLogo :name="org.name" :logo-url="org.logoUrl" class="size-8" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium">{{ org.name }}</p>
            <p class="text-muted-foreground text-xs">{{ roleLabel(org.role) }}</p>
          </div>
          <Button variant="outline" size="sm" @click="askLeave(org)"><LogOut /> Quitter</Button>
        </li>
      </ul>
    </CardContent>
  </Card>

  <ConfirmDialog
    v-model:open="confirmOpen"
    :title="`Quitter ${target?.name ?? ''} ?`"
    :description="
      target && isOwner(target)
        ? 'Vous perdrez l\'accès à ses applications. S\'il n\'y a pas d\'autre gérant, transférez d\'abord votre rôle depuis la page Personnes.'
        : 'Vous perdrez immédiatement l\'accès à ses applications. Il faudra une nouvelle invitation pour revenir.'
    "
    confirm-label="Quitter"
    destructive
    :loading="leaving"
    @confirm="leave"
  />
</template>
