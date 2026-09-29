<script setup lang="ts">
import { toast } from "vue-sonner";
import { errorMessage } from "~/lib/errors";
import { formatDate, roleLabel } from "~/lib/labels";

interface OrgDetailResponse {
  organization: {
    id: string;
    name: string;
    slug: string;
    apps: string[] | null;
    requireTwoFactor: boolean | null;
    createdAt: string;
  };
  members: { id: string; role: string; name: string; email: string; twoFactorEnabled: boolean | null }[];
  invitations: { id: string; email: string; role: string; expiresAt: string }[];
}

const props = defineProps<{ id: string }>();
const emit = defineEmits<{ changed: [] }>();

const detail = ref<OrgDetailResponse | null>(null);
const apps = ref<string[]>([]);
const ownerEmail = ref("");
const saving = ref(false);
const tab = ref("members");
const memberQuery = ref("");

const filteredMembers = computed(() => {
  const q = memberQuery.value.trim().toLowerCase();
  const members = detail.value?.members ?? [];
  return q ? members.filter((m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)) : members;
});

const appsChanged = computed(() => {
  const saved = [...(detail.value?.organization.apps ?? [])].sort().join();
  return saved !== [...apps.value].sort().join();
});

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

const fail = (e: unknown) => toast.error(errorMessage((e as { data?: unknown }).data ?? e));

async function load() {
  try {
    detail.value = await $fetch<OrgDetailResponse>(`/api/admin/organizations/${props.id}`);
    apps.value = detail.value.organization.apps ?? [];
  } catch (e) {
    fail(e);
  }
}

async function saveApps() {
  saving.value = true;
  try {
    await $fetch(`/api/admin/organizations/${props.id}`, { method: "PATCH", body: { apps: apps.value } });
    toast.success("Applications autorisées mises à jour.");
    emit("changed");
    await load();
  } catch (e) {
    fail(e);
  } finally {
    saving.value = false;
  }
}

async function setTwoFactor(value: boolean) {
  try {
    await $fetch(`/api/admin/organizations/${props.id}`, { method: "PATCH", body: { requireTwoFactor: value } });
    toast.success(value ? "Double authentification obligatoire." : "Double authentification facultative.");
    emit("changed");
    await load();
  } catch (e) {
    fail(e);
  }
}

async function inviteOwner() {
  try {
    await $fetch(`/api/admin/organizations/${props.id}/owner-invitations`, { method: "POST", body: { email: ownerEmail.value } });
    toast.success(`Invitation gérant envoyée à ${ownerEmail.value}.`);
    ownerEmail.value = "";
    emit("changed");
    await load();
  } catch (e) {
    fail(e);
  }
}

watch(() => props.id, load, { immediate: true });
</script>

<template>
  <PageLoader v-if="!detail" />
  <template v-else>
    <SheetHeader>
      <div class="flex items-center gap-3">
        <span class="bg-muted flex size-11 items-center justify-center rounded-xl border text-lg font-semibold">
          {{ detail.organization.name[0]?.toUpperCase() }}
        </span>
        <div class="min-w-0">
          <SheetTitle class="truncate">{{ detail.organization.name }}</SheetTitle>
          <SheetDescription>{{ detail.organization.slug }} · créée le {{ formatDate(detail.organization.createdAt) }}</SheetDescription>
        </div>
      </div>
    </SheetHeader>

    <SheetBody>
      <section class="space-y-3">
        <div>
          <h3 class="text-sm font-semibold">Applications autorisées</h3>
          <p class="text-muted-foreground text-xs">Les rôles de l'organisation ne peuvent pas dépasser ce plafond.</p>
        </div>
        <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
          <AdminAppsPicker v-model="apps" />
          <Button size="sm" :disabled="!appsChanged || saving" @click="saveApps">Enregistrer</Button>
        </div>
      </section>

      <section class="space-y-3">
        <h3 class="text-sm font-semibold">Sécurité</h3>
        <div class="flex items-center justify-between gap-4 rounded-lg border p-3">
          <div>
            <p class="text-sm">Exiger la double authentification</p>
            <p class="text-muted-foreground text-xs">Le gérant peut aussi modifier ce réglage.</p>
          </div>
          <Switch
            :model-value="detail.organization.requireTwoFactor === true"
            aria-label="Exiger la double authentification"
            @update:model-value="setTwoFactor"
          />
        </div>
      </section>

      <Tabs v-model="tab" class="gap-4">
        <TabsList class="w-full">
          <TabsTrigger value="members">Membres · {{ detail.members.length }}</TabsTrigger>
          <TabsTrigger value="invitations">Invitations · {{ detail.invitations.length }}</TabsTrigger>
        </TabsList>

        <TabsContent value="members" class="space-y-3">
          <SearchInput v-if="detail.members.length > 5" v-model="memberQuery" placeholder="Rechercher un membre" class="sm:max-w-none" />
          <p v-if="!detail.members.length" class="text-muted-foreground rounded-lg border border-dashed p-4 text-center text-sm">
            Aucun membre pour l'instant.
          </p>
          <p v-else-if="!filteredMembers.length" class="text-muted-foreground p-4 text-center text-sm">Aucun membre ne correspond.</p>
          <ul v-else class="max-h-[26rem] divide-y overflow-y-auto rounded-lg border">
            <li v-for="m in filteredMembers" :key="m.id" class="flex items-center gap-3 px-3 py-2.5">
              <span class="bg-muted flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                {{ initials(m.name || m.email) }}
              </span>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium">{{ m.name }}</p>
                <p class="text-muted-foreground truncate text-xs">{{ m.email }}</p>
              </div>
              <TwoFactorBadge :enabled="m.twoFactorEnabled === true" :required="detail.organization.requireTwoFactor === true" />
              <Badge variant="outline">{{ roleLabel(m.role) }}</Badge>
            </li>
          </ul>
          <p v-if="memberQuery && filteredMembers.length" class="text-muted-foreground text-xs">
            {{ filteredMembers.length }} sur {{ detail.members.length }}
          </p>
        </TabsContent>

        <TabsContent value="invitations" class="space-y-4">
          <form class="flex items-end gap-2" @submit.prevent="inviteOwner">
            <div class="flex-1"><FormField v-model="ownerEmail" label="Inviter un gérant" type="email" placeholder="nom@entreprise.fr" required /></div>
            <Button type="submit" variant="outline">Inviter</Button>
          </form>
          <p v-if="!detail.invitations.length" class="text-muted-foreground rounded-lg border border-dashed p-4 text-center text-sm">
            Aucune invitation en attente.
          </p>
          <ul v-else class="max-h-[22rem] divide-y overflow-y-auto rounded-lg border">
            <li v-for="i in detail.invitations" :key="i.id" class="flex items-center gap-3 px-3 py-2.5">
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm">{{ i.email }}</p>
                <p class="text-muted-foreground text-xs">Expire le {{ formatDate(i.expiresAt) }}</p>
              </div>
              <Badge variant="outline">{{ roleLabel(i.role) }}</Badge>
            </li>
          </ul>
        </TabsContent>
      </Tabs>
    </SheetBody>
  </template>
</template>
