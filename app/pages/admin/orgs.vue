<script setup lang="ts">
import { watchDebounced } from "@vueuse/core";
import { toast } from "vue-sonner";
import { Building2, Copy, Ellipsis, MailPlus, PanelRightOpen, Plus, Users } from "lucide-vue-next";
import { APP_IDS } from "#shared/permissions";
import { errorMessage } from "~/lib/errors";
import { RESOURCE_LABELS } from "~/lib/labels";

definePageMeta({ layout: "admin", middleware: "admin" });
useHead({ title: "Organisations" });

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  apps: string[] | null;
  createdAt: string;
  memberCount: number;
  pendingInvitations: number;
}

const q = ref("");
const appFilter = ref<string | null>(null);
const orgs = ref<OrgRow[] | null>(null);
const error = ref("");
const creating = ref(false);
const selected = ref<string | null>(null);
const detailOpen = ref(false);
const inviteFor = ref<OrgRow | null>(null);
const inviteOpen = ref(false);
const inviteEmail = ref("");

const rows = computed(() => (orgs.value ?? []).filter((o) => !appFilter.value || (o.apps ?? []).includes(appFilter.value)));
const summary = computed(() => {
  const list = orgs.value ?? [];
  const members = list.reduce((n, o) => n + o.memberCount, 0);
  const pending = list.reduce((n, o) => n + o.pendingInvitations, 0);
  const parts = [`${list.length} organisation${list.length > 1 ? "s" : ""}`, `${members} membre${members > 1 ? "s" : ""}`];
  if (pending) parts.push(`${pending} invitation${pending > 1 ? "s" : ""} en attente`);
  return parts.join(" · ");
});

const dateOnly = (value: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(value));

async function load() {
  try {
    orgs.value = (await $fetch<{ organizations: OrgRow[] }>("/api/admin/organizations", { query: { q: q.value } })).organizations;
    error.value = "";
  } catch (e) {
    error.value = errorMessage((e as { data?: unknown }).data ?? e);
  }
}

function onCreated() {
  creating.value = false;
  load();
}

function openDetail(org: OrgRow) {
  selected.value = org.id;
  detailOpen.value = true;
}

function openInvite(org: OrgRow) {
  inviteEmail.value = "";
  inviteFor.value = org;
  inviteOpen.value = true;
}

async function sendInvite() {
  const org = inviteFor.value;
  if (!org) return;
  try {
    await $fetch(`/api/admin/organizations/${org.id}/owner-invitations`, { method: "POST", body: { email: inviteEmail.value } });
    toast.success(`Invitation gérant envoyée à ${inviteEmail.value}.`);
    inviteOpen.value = false;
    load();
  } catch (e) {
    toast.error(errorMessage((e as { data?: unknown }).data ?? e));
  }
}

async function copyId(org: OrgRow) {
  await navigator.clipboard.writeText(org.id);
  toast.success("Identifiant copié.");
}

watchDebounced(q, load, { debounce: 200 });
onMounted(load);
</script>

<template>
  <PageHeader title="Organisations" :description="orgs ? summary : undefined">
    <template #actions>
      <Button @click="creating = true"><Plus /> Nouvelle organisation</Button>
    </template>
  </PageHeader>

  <FormAlert :message="error" />

  <div class="bg-card overflow-hidden rounded-xl border shadow-sm">
    <div class="flex flex-wrap items-center gap-2 border-b p-3">
      <SearchInput v-model="q" placeholder="Rechercher par nom ou slug" />
      <div class="bg-muted flex items-center gap-0.5 rounded-lg p-0.5">
        <button
          v-for="option in [null, ...APP_IDS]"
          :key="option ?? 'all'"
          type="button"
          class="cursor-pointer rounded-md px-2.5 py-1 text-sm transition-colors"
          :class="appFilter === option ? 'bg-background text-foreground font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground'"
          @click="appFilter = option"
        >
          {{ option ? (RESOURCE_LABELS[option] ?? option) : "Toutes" }}
        </button>
      </div>
    </div>

    <PageLoader v-if="!orgs" />
    <div v-else-if="!rows.length" class="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <span class="bg-muted flex size-10 items-center justify-center rounded-xl"><Building2 class="text-muted-foreground size-5" /></span>
      <p class="font-medium">{{ q || appFilter ? "Aucun résultat" : "Aucune organisation" }}</p>
      <p class="text-muted-foreground text-sm">
        {{ q || appFilter ? "Essayez une autre recherche ou un autre filtre." : "Créez la première pour inviter son gérant." }}
      </p>
    </div>
    <Table v-else>
      <TableHeader>
        <TableRow class="hover:bg-transparent">
          <TableHead class="pl-4">Organisation</TableHead>
          <TableHead>Applications</TableHead>
          <TableHead>Membres</TableHead>
          <TableHead class="hidden md:table-cell">Créée le</TableHead>
          <TableHead class="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow
          v-for="o in rows"
          :key="o.id"
          class="cursor-pointer"
          :data-state="detailOpen && selected === o.id ? 'selected' : undefined"
          @click="openDetail(o)"
        >
          <TableCell class="pl-4">
            <div class="flex items-center gap-3">
              <span class="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg border text-sm font-semibold">
                {{ o.name[0]?.toUpperCase() }}
              </span>
              <div class="min-w-0">
                <p class="truncate font-medium">{{ o.name }}</p>
                <p class="text-muted-foreground truncate text-xs">{{ o.slug }}</p>
              </div>
            </div>
          </TableCell>
          <TableCell>
            <div class="flex flex-wrap gap-1">
              <Badge v-for="a in o.apps ?? []" :key="a" variant="outline">{{ RESOURCE_LABELS[a] ?? a }}</Badge>
              <span v-if="!(o.apps ?? []).length" class="text-muted-foreground text-xs">Aucune</span>
            </div>
          </TableCell>
          <TableCell>
            <div class="flex items-center gap-2">
              <span class="text-muted-foreground flex items-center gap-1.5 tabular-nums"><Users class="size-3.5" /> {{ o.memberCount }}</span>
              <span
                v-if="o.pendingInvitations"
                class="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"
                :title="`${o.pendingInvitations} invitation(s) en attente`"
              >
                +{{ o.pendingInvitations }} invité{{ o.pendingInvitations > 1 ? "s" : "" }}
              </span>
            </div>
          </TableCell>
          <TableCell class="text-muted-foreground hidden md:table-cell">{{ dateOnly(o.createdAt) }}</TableCell>
          <TableCell class="pr-3 text-right" @click.stop>
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <Button variant="ghost" size="icon" class="size-8" :aria-label="`Actions pour ${o.name}`"><Ellipsis /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>{{ o.name }}</DropdownMenuLabel>
                <DropdownMenuItem @select="openDetail(o)"><PanelRightOpen /> Ouvrir le détail</DropdownMenuItem>
                <DropdownMenuItem @select="openInvite(o)"><MailPlus /> Inviter un gérant</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem @select="copyId(o)"><Copy /> Copier l'identifiant</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
    <div v-if="orgs && rows.length" class="text-muted-foreground border-t px-4 py-2.5 text-xs">
      {{ rows.length }} résultat{{ rows.length > 1 ? "s" : "" }}
    </div>
  </div>

  <Dialog v-model:open="creating">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Nouvelle organisation</DialogTitle>
        <DialogDescription>L'organisation est créée et son gérant reçoit une invitation par email.</DialogDescription>
      </DialogHeader>
      <AdminCreateOrgForm v-if="creating" @created="onCreated" @cancel="creating = false" />
    </DialogContent>
  </Dialog>

  <Dialog v-model:open="inviteOpen">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Inviter un gérant</DialogTitle>
        <DialogDescription>La personne recevra une invitation pour gérer {{ inviteFor?.name }}.</DialogDescription>
      </DialogHeader>
      <form class="space-y-5" @submit.prevent="sendInvite">
        <FormField v-model="inviteEmail" label="Email" type="email" placeholder="nom@entreprise.fr" required />
        <DialogFooter>
          <Button type="button" variant="outline" @click="inviteOpen = false">Annuler</Button>
          <Button type="submit">Envoyer l'invitation</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>

  <Sheet v-model:open="detailOpen">
    <SheetContent>
      <AdminOrgDetail v-if="selected" :id="selected" @changed="load" />
    </SheetContent>
  </Sheet>
</template>
