<script setup lang="ts">
import { toast } from "vue-sonner";
import { Copy, Ellipsis, Mail, MailX, PanelRightOpen, Send, UserMinus, Users } from "lucide-vue-next";
import { authClient } from "~/lib/auth-client";
import { errorMessage } from "~/lib/errors";
import { formatDate, roleLabel, roleOptions } from "~/lib/labels";
import type { ManagedOrganization, OrgInvitation, OrgMember, OrgRights, PeopleFilter } from "~/lib/org";

type Row = { kind: "member"; id: string; member: OrgMember } | { kind: "invitation"; id: string; invitation: OrgInvitation };

const props = defineProps<{
  org: ManagedOrganization;
  roles: string[];
  rights: OrgRights;
}>();
const emit = defineEmits<{ changed: []; invite: [] }>();

const session = authClient.useSession();
const route = useRoute();
const filter = ref<PeopleFilter>(
  ["members", "pending", "no2fa"].includes(route.query.filter as string) ? (route.query.filter as PeopleFilter) : "all",
);
const { q, page, data, loading, pageSize, load, reload } = usePeoplePage("/api/account/organization/people", filter);
watch(() => props.org.id, reload);
const busy = ref(false);

const member = ref<OrgMember | null>(null);
const invitation = ref<OrgInvitation | null>(null);
const detailOpen = ref(false);
const removeOpen = ref(false);
const cancelOpen = ref(false);
const newRole = ref("");

const required = computed(() => props.org.requireTwoFactor);
const counts = computed(() => data.value?.counts ?? { members: 0, pending: 0, withoutTwoFactor: 0 });

const FILTERS = computed(() => [
  { id: "all" as const, label: "Tous" },
  { id: "members" as const, label: "Membres", count: counts.value.members },
  { id: "pending" as const, label: "En attente", count: counts.value.pending },
  { id: "no2fa" as const, label: "Sans 2FA", count: counts.value.withoutTwoFactor },
]);

const rows = computed<Row[]>(() =>
  (data.value?.rows ?? []).map((r) => (r.kind === "member" ? { kind: "member", id: r.id, member: r } : { kind: "invitation", id: r.id, invitation: r })),
);

watch(data, (res) => {
  if (!member.value || !res) return;
  const fresh = res.rows.find((r): r is OrgMember => r.kind === "member" && r.id === member.value!.id);
  if (fresh) member.value = fresh;
});

defineExpose({ reload: load });

function changed() {
  load();
  emit("changed");
}

const isSelf = (m: OrgMember) => m.userId === session.value.data?.user.id;
const canAct = (m: OrgMember) => props.rights.members && !isSelf(m);
const initials = (m: OrgMember) =>
  (m.user.name || m.user.email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
const dateOnly = (value: string | Date) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(value));
function expiresIn(value: string | Date) {
  const days = Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000);
  return days <= 1 ? "expire aujourd'hui" : `expire dans ${days} j`;
}

function openMember(m: OrgMember) {
  member.value = m;
  newRole.value = m.role;
  detailOpen.value = true;
}

function askRemove(m: OrgMember) {
  member.value = m;
  removeOpen.value = true;
}

function askCancel(i: OrgInvitation) {
  invitation.value = i;
  cancelOpen.value = true;
}

async function saveRole() {
  const m = member.value;
  if (!m) return;
  busy.value = true;
  const res = await authClient.organization.updateMemberRole({ memberId: m.id, role: newRole.value, organizationId: props.org.id });
  busy.value = false;
  if (res.error) return toast.error(errorMessage(res.error));
  member.value = { ...m, role: newRole.value };
  toast.success("Rôle mis à jour.");
  changed();
}

async function removeMember() {
  const m = member.value;
  if (!m) return;
  busy.value = true;
  const res = await authClient.organization.removeMember({ memberIdOrEmail: m.id, organizationId: props.org.id });
  busy.value = false;
  if (res.error) return toast.error(errorMessage(res.error));
  removeOpen.value = false;
  detailOpen.value = false;
  toast.success(`${m.user.email} a été retiré.`);
  changed();
}

async function resend(i: OrgInvitation) {
  const res = await authClient.organization.inviteMember({
    email: i.email,
    role: i.role as "member",
    organizationId: props.org.id,
    resend: true,
  });
  if (res.error) return toast.error(errorMessage(res.error));
  toast.success(`Invitation renvoyée à ${i.email}.`);
  changed();
}

async function copyLink(i: OrgInvitation) {
  await navigator.clipboard.writeText(`${window.location.origin}/invite/${i.id}?email=${encodeURIComponent(i.email)}`);
  toast.success("Lien d'invitation copié.");
}

async function cancelInvitation() {
  const i = invitation.value;
  if (!i) return;
  busy.value = true;
  const res = await authClient.organization.cancelInvitation({ invitationId: i.id });
  busy.value = false;
  if (res.error) return toast.error(errorMessage(res.error));
  cancelOpen.value = false;
  toast.success("Invitation annulée.");
  changed();
}
</script>

<template>
  <div class="bg-card overflow-hidden rounded-xl border shadow-sm">
    <div class="flex flex-wrap items-center gap-2 border-b p-3">
      <SearchInput v-model="q" placeholder="Rechercher une personne" />
      <div class="bg-muted flex flex-wrap items-center gap-0.5 rounded-lg p-0.5">
        <button
          v-for="f in FILTERS"
          :key="f.id"
          type="button"
          class="flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-sm transition-colors"
          :class="filter === f.id ? 'bg-background text-foreground font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground'"
          @click="filter = f.id"
        >
          {{ f.label }}
          <span v-if="f.count !== undefined" class="text-muted-foreground text-xs tabular-nums">{{ f.count }}</span>
        </button>
      </div>
    </div>

    <PageLoader v-if="!data" />
    <div v-else-if="!rows.length" class="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <span class="bg-muted flex size-10 items-center justify-center rounded-lg"><Users class="text-muted-foreground size-5" /></span>
      <p class="font-medium">{{ filter === "pending" ? "Aucune invitation en attente" : "Personne ne correspond" }}</p>
      <Button v-if="filter === 'pending' && rights.invite" variant="outline" size="sm" class="mt-2" @click="emit('invite')">Inviter un membre</Button>
    </div>
    <Table v-else :class="loading && 'opacity-60 transition-opacity'">
      <TableHeader>
        <TableRow class="hover:bg-transparent">
          <TableHead class="pl-4">Personne</TableHead>
          <TableHead>Rôle</TableHead>
          <TableHead>Statut</TableHead>
          <TableHead class="hidden md:table-cell">Depuis</TableHead>
          <TableHead class="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        <template v-for="row in rows" :key="row.id">
          <TableRow
            v-if="row.kind === 'member'"
            class="cursor-pointer"
            :data-state="detailOpen && member?.id === row.member.id ? 'selected' : undefined"
            @click="openMember(row.member)"
          >
            <TableCell class="pl-4">
              <div class="flex items-center gap-3">
                <span class="bg-muted flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-medium">{{ initials(row.member) }}</span>
                <div class="min-w-0">
                  <p class="truncate font-medium">
                    {{ row.member.user.name || "Sans nom" }}
                    <span v-if="isSelf(row.member)" class="text-muted-foreground text-xs font-normal">(vous)</span>
                  </p>
                  <p class="text-muted-foreground truncate text-xs">{{ row.member.user.email }}</p>
                </div>
              </div>
            </TableCell>
            <TableCell><Badge variant="outline">{{ roleLabel(row.member.role) }}</Badge></TableCell>
            <TableCell><TwoFactorBadge :enabled="row.member.twoFactor" :required="required" /></TableCell>
            <TableCell class="text-muted-foreground hidden md:table-cell">{{ dateOnly(row.member.createdAt) }}</TableCell>
            <TableCell class="pr-3 text-right" @click.stop>
              <DropdownMenu v-if="canAct(row.member)">
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="icon" class="size-8" :aria-label="`Actions pour ${row.member.user.email}`"><Ellipsis /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel class="max-w-56 truncate">{{ row.member.user.email }}</DropdownMenuLabel>
                  <DropdownMenuItem @select="openMember(row.member)"><PanelRightOpen /> Ouvrir le détail</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" @select="askRemove(row.member)"><UserMinus /> Retirer de l'organisation</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>

          <TableRow v-else class="bg-muted/30">
            <TableCell class="pl-4">
              <div class="flex items-center gap-3">
                <span class="bg-background flex size-9 shrink-0 items-center justify-center rounded-full border border-dashed">
                  <Mail class="text-muted-foreground size-4" />
                </span>
                <div class="min-w-0">
                  <p class="text-muted-foreground truncate">{{ row.invitation.email }}</p>
                  <p class="text-muted-foreground text-xs">Invitation envoyée</p>
                </div>
              </div>
            </TableCell>
            <TableCell><Badge variant="outline">{{ roleLabel(row.invitation.role) }}</Badge></TableCell>
            <TableCell>
              <span class="inline-flex items-center gap-1.5 text-xs whitespace-nowrap text-amber-700">
                <span class="size-1.5 rounded-full bg-amber-500" /> Invitée · {{ expiresIn(row.invitation.expiresAt) }}
              </span>
            </TableCell>
            <TableCell class="text-muted-foreground hidden md:table-cell">—</TableCell>
            <TableCell class="pr-3 text-right">
              <DropdownMenu v-if="rights.invite">
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="icon" class="size-8" :aria-label="`Actions pour ${row.invitation.email}`"><Ellipsis /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel class="max-w-56 truncate">{{ row.invitation.email }}</DropdownMenuLabel>
                  <DropdownMenuItem @select="resend(row.invitation)"><Send /> Renvoyer l'email</DropdownMenuItem>
                  <DropdownMenuItem @select="copyLink(row.invitation)"><Copy /> Copier le lien</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" @select="askCancel(row.invitation)"><MailX /> Annuler l'invitation</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        </template>
      </TableBody>
    </Table>
    <TablePagination v-if="data && rows.length" v-model="page" :total="data.total" :page-size="pageSize" />
  </div>

  <Sheet v-model:open="detailOpen">
    <SheetContent>
      <template v-if="member">
        <SheetHeader>
          <div class="flex items-center gap-3">
            <span class="bg-muted flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold">{{ initials(member) }}</span>
            <div class="min-w-0">
              <SheetTitle class="truncate">{{ member.user.name || member.user.email }}</SheetTitle>
              <SheetDescription class="truncate">{{ member.user.email }}</SheetDescription>
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-2 pt-2">
            <Badge variant="outline">{{ roleLabel(member.role) }}</Badge>
            <TwoFactorBadge :enabled="member.twoFactor" :required="required" />
            <Badge v-if="isSelf(member)" variant="secondary">Vous</Badge>
          </div>
        </SheetHeader>
        <SheetBody>
          <section class="space-y-3">
            <h3 class="text-sm font-semibold">Informations</h3>
            <dl class="divide-y rounded-lg border text-sm">
              <div class="flex justify-between gap-4 px-3 py-2.5">
                <dt class="text-muted-foreground">Membre depuis</dt>
                <dd>{{ formatDate(member.createdAt) }}</dd>
              </div>
              <div class="flex justify-between gap-4 px-3 py-2.5">
                <dt class="text-muted-foreground">Double authentification</dt>
                <dd><TwoFactorBadge :enabled="member.twoFactor" :required="required" /></dd>
              </div>
            </dl>
          </section>

          <section v-if="canAct(member)" class="space-y-3">
            <div>
              <h3 class="text-sm font-semibold">Rôle</h3>
              <p class="text-muted-foreground text-xs">Détermine ce que {{ member.user.name || "ce membre" }} peut faire dans vos applications.</p>
            </div>
            <form class="flex items-end gap-2" @submit.prevent="saveRole">
              <div class="flex-1">
                <AppSelect v-model="newRole" :options="roleOptions([...roles, member.role])" aria-label="Rôle" />
              </div>
              <Button type="submit" :disabled="busy || newRole === member.role">Enregistrer</Button>
            </form>
          </section>

          <section v-if="canAct(member)" class="space-y-3">
            <h3 class="text-sm font-semibold">Zone sensible</h3>
            <div class="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div>
                <p class="text-sm font-medium text-red-700">Retirer de l'organisation</p>
                <p class="text-muted-foreground text-xs">L'accès aux applications est coupé immédiatement.</p>
              </div>
              <Button variant="destructive" size="sm" @click="askRemove(member)"><UserMinus /> Retirer</Button>
            </div>
          </section>
        </SheetBody>
      </template>
    </SheetContent>
  </Sheet>

  <ConfirmDialog
    v-model:open="removeOpen"
    :title="`Retirer ${member?.user.email ?? ''} ?`"
    description="Cette personne perdra immédiatement l'accès aux applications de l'organisation. Vous pourrez l'inviter à nouveau plus tard."
    confirm-label="Retirer"
    destructive
    :loading="busy"
    @confirm="removeMember"
  />
  <ConfirmDialog
    v-model:open="cancelOpen"
    :title="`Annuler l'invitation de ${invitation?.email ?? ''} ?`"
    description="Le lien reçu par email ne fonctionnera plus."
    confirm-label="Annuler l'invitation"
    destructive
    :loading="busy"
    @confirm="cancelInvitation"
  />
</template>
