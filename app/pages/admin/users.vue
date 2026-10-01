<script setup lang="ts">
import { watchDebounced } from "@vueuse/core";
import { toast } from "vue-sonner";
import { Copy, Ellipsis, LogIn, PanelRightOpen, ShieldCheck, ShieldOff, Users } from "lucide-vue-next";
import { authClient, isGlobalAdmin } from "~/lib/auth-client";
import { errorMessage } from "~/lib/errors";
import type { AdminUser } from "~/lib/types";

definePageMeta({ layout: "admin", middleware: "admin" });
useHead({ title: "Utilisateurs" });

const PAGE_SIZE = 25;
const FILTERS = [
  { id: "all", label: "Tous" },
  { id: "admin", label: "Admins", field: "role", value: "admin" },
  { id: "banned", label: "Suspendus", field: "banned", value: true },
  { id: "unverified", label: "Non vérifiés", field: "emailVerified", value: false },
] as const;

const session = authClient.useSession();
const q = ref("");
const filter = ref<(typeof FILTERS)[number]["id"]>("all");
const page = ref(0);
const users = ref<AdminUser[] | null>(null);
const total = ref(0);
const busy = ref(false);

const selectedId = ref<string | null>(null);
const detailOpen = ref(false);
const selected = computed(() => users.value?.find((u) => u.id === selectedId.value) ?? null);

const deleteTarget = ref<AdminUser | null>(null);
const deleteOpen = ref(false);
const deleteConfirm = ref("");
const resetTarget = ref<AdminUser | null>(null);
const resetOpen = ref(false);
const banTarget = ref<AdminUser | null>(null);
const banOpen = ref(false);
const banReason = ref("");

const isSelf = (u: AdminUser) => session.value.data?.user.id === u.id;
const initials = (u: AdminUser) =>
  (u.name || u.email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
const dateOnly = (value: string | Date) =>
  new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(value));

async function load() {
  const active = FILTERS.find((f) => f.id === filter.value);
  const res = await authClient.admin.listUsers({
    query: {
      limit: PAGE_SIZE,
      offset: page.value * PAGE_SIZE,
      sortBy: "createdAt",
      sortDirection: "desc",
      ...(q.value ? { searchValue: q.value, searchField: "email" as const, searchOperator: "contains" as const } : {}),
      ...(active && "field" in active
        ? { filterField: active.field, filterValue: active.value, filterOperator: "eq" as const }
        : {}),
    },
  });

  if (res.error) return toast.error(errorMessage(res.error));
  users.value = (res.data?.users ?? []) as unknown as AdminUser[];
  total.value = res.data?.total ?? 0;
}

function openDetail(u: AdminUser) {
  selectedId.value = u.id;
  detailOpen.value = true;
}

async function run(action: () => Promise<{ error: unknown }>, success: string) {
  busy.value = true;
  const res = await action();

  busy.value = false;
  if (res.error) {
    toast.error(errorMessage(res.error));

    return false;
  }

  toast.success(success);
  await load();

  return true;
}

async function impersonate(u: AdminUser) {
  busy.value = true;
  const res = await authClient.admin.impersonateUser({ userId: u.id });

  if (res.error) {
    busy.value = false;

    return toast.error(errorMessage(res.error));
  }

  window.location.href = "/";
}

function askBan(u: AdminUser) {
  banTarget.value = u;
  banReason.value = "";
  banOpen.value = true;
}

async function confirmBan() {
  const u = banTarget.value;

  if (!u) return;
  const ok = await run(
    () => authClient.admin.banUser({ userId: u.id, banReason: banReason.value || undefined }),
    `${u.email} est suspendu.`,
  );

  if (ok) banOpen.value = false;
}

function askReset(u: AdminUser) {
  resetTarget.value = u;
  resetOpen.value = true;
}

async function confirmReset() {
  const u = resetTarget.value;

  if (!u) return;
  busy.value = true;
  try {
    await $fetch(`/api/admin/users/${u.id}/two-factor/reset`, { method: "POST" });
    toast.success(`Double authentification de ${u.email} réinitialisée.`);
    resetOpen.value = false;
    await load();
  } catch (e) {
    toast.error(errorMessage((e as { data?: unknown }).data ?? e));
  } finally {
    busy.value = false;
  }
}

async function exportData(u: AdminUser) {
  busy.value = true;
  try {
    const res = await fetch(`/api/admin/users/${encodeURIComponent(u.id)}/export`, {
      headers: { accept: "application/json" },
    });

    if (!res.ok) throw await res.json().catch(() => ({ status: res.status }));
    const filename = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "donnees.json";
    const url = URL.createObjectURL(await res.blob());
    const link = Object.assign(document.createElement("a"), { href: url, download: filename });

    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Données de ${u.email} exportées.`);
  } catch (e) {
    toast.error(errorMessage(e));
  } finally {
    busy.value = false;
  }
}

function askDelete(u: AdminUser) {
  deleteTarget.value = u;
  deleteConfirm.value = "";
  deleteOpen.value = true;
}

async function confirmDelete() {
  const u = deleteTarget.value;

  if (!u || deleteConfirm.value.trim().toLowerCase() !== u.email.toLowerCase()) return;
  busy.value = true;
  try {
    await $fetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
    toast.success(`Le compte ${u.email} a été supprimé.`);
    deleteOpen.value = false;
    detailOpen.value = false;
    await load();
  } catch (e) {
    toast.error(errorMessage((e as { data?: unknown }).data ?? e));
  } finally {
    busy.value = false;
  }
}

const unban = (u: AdminUser) => run(() => authClient.admin.unbanUser({ userId: u.id }), "Suspension levée.");

async function copyId(u: AdminUser) {
  await navigator.clipboard.writeText(u.id);
  toast.success("Identifiant copié.");
}

watchDebounced(
  q,
  () => {
    page.value = 0;
    load();
  },
  { debounce: 200 },
);
watch(filter, () => {
  page.value = 0;
  load();
});
watch(page, load);
onMounted(load);
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Utilisateurs"
      :description="users ? `${total} utilisateur${total > 1 ? 's' : ''}` : undefined"
    />

    <div class="bg-card overflow-hidden rounded-xl border shadow-sm">
      <div class="flex flex-wrap items-center gap-2 border-b p-3">
        <SearchInput
          v-model="q"
          placeholder="Rechercher par email"
        />

        <div class="bg-muted flex flex-wrap items-center gap-0.5 rounded-lg p-0.5">
          <button
            v-for="f in FILTERS"
            :key="f.id"
            type="button"
            class="cursor-pointer rounded-md px-2.5 py-1 text-sm transition-colors"
            :class="
              filter === f.id
                ? 'bg-background text-foreground font-medium shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            "
            @click="filter = f.id"
          >
            {{ f.label }}
          </button>
        </div>
      </div>

      <PageLoader v-if="!users" />

      <div
        v-else-if="!users.length"
        class="flex flex-col items-center gap-2 px-6 py-14 text-center"
      >
        <span class="bg-muted flex size-10 items-center justify-center rounded-xl">
          <Users class="text-muted-foreground size-5" />
        </span>

        <p class="font-medium">Aucun utilisateur</p>

        <p class="text-muted-foreground text-sm">Essayez une autre recherche ou un autre filtre.</p>
      </div>

      <template v-else>
        <Table>
          <TableHeader>
            <TableRow class="hover:bg-transparent">
              <TableHead class="pl-4">Utilisateur</TableHead>

              <TableHead>Statut</TableHead>

              <TableHead class="hidden sm:table-cell">Sécurité</TableHead>

              <TableHead class="hidden md:table-cell">Inscrit le</TableHead>

              <TableHead class="w-12" />
            </TableRow>
          </TableHeader>

          <TableBody>
            <TableRow
              v-for="u in users"
              :key="u.id"
              class="cursor-pointer"
              :data-state="detailOpen && selectedId === u.id ? 'selected' : undefined"
              @click="openDetail(u)"
            >
              <TableCell class="pl-4">
                <div class="flex items-center gap-3">
                  <span
                    class="bg-muted flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-medium"
                  >
                    {{ initials(u) }}
                  </span>

                  <div class="min-w-0">
                    <p class="truncate font-medium">
                      {{ u.name || "Sans nom" }}
                      <span
                        v-if="isSelf(u)"
                        class="text-muted-foreground text-xs font-normal"
                      >
                        (vous)
                      </span>
                    </p>

                    <p class="text-muted-foreground truncate text-xs">{{ u.email }}</p>
                  </div>
                </div>
              </TableCell>

              <TableCell>
                <div class="flex flex-wrap gap-1">
                  <Badge
                    v-if="u.deletedAt"
                    variant="outline"
                  >
                    Supprimé
                  </Badge>

                  <template v-else>
                    <Badge
                      v-if="isGlobalAdmin(u)"
                      variant="warning"
                    >
                      Admin
                    </Badge>

                    <Badge
                      v-if="u.banned"
                      variant="destructive"
                    >
                      Suspendu
                    </Badge>

                    <Badge
                      v-if="!u.emailVerified"
                      variant="outline"
                    >
                      Non vérifié
                    </Badge>
                  </template>

                  <span
                    v-if="!u.deletedAt && !isGlobalAdmin(u) && !u.banned && u.emailVerified"
                    class="flex items-center gap-1.5 text-xs text-emerald-700"
                  >
                    <span class="size-1.5 rounded-full bg-emerald-500" />
                    Actif
                  </span>
                </div>
              </TableCell>

              <TableCell class="hidden sm:table-cell">
                <span
                  v-if="isGlobalAdmin(u)"
                  class="text-muted-foreground text-xs"
                >
                  Via Authentik
                </span>

                <TwoFactorBadge
                  v-else
                  :enabled="u.twoFactorEnabled === true || u.hasPasskey === true"
                />
              </TableCell>

              <TableCell class="text-muted-foreground hidden md:table-cell">{{ dateOnly(u.createdAt) }}</TableCell>

              <TableCell
                class="pr-3 text-right"
                @click.stop
              >
                <DropdownMenu>
                  <DropdownMenuTrigger as-child>
                    <Button
                      variant="ghost"
                      size="icon"
                      class="size-8"
                      :aria-label="`Actions pour ${u.email}`"
                    >
                      <Ellipsis />
                    </Button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent>
                    <DropdownMenuLabel class="max-w-56 truncate">{{ u.email }}</DropdownMenuLabel>

                    <DropdownMenuItem @select="openDetail(u)">
                      <PanelRightOpen />
                      Ouvrir le détail
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      v-if="!isSelf(u) && !isGlobalAdmin(u) && !u.banned && !u.deletedAt"
                      @select="impersonate(u)"
                    >
                      <LogIn />
                      Se connecter en tant que
                    </DropdownMenuItem>

                    <DropdownMenuItem @select="copyId(u)">
                      <Copy />
                      Copier l'identifiant
                    </DropdownMenuItem>

                    <template v-if="!isSelf(u) && !u.deletedAt">
                      <DropdownMenuSeparator />

                      <DropdownMenuItem
                        v-if="u.banned"
                        @select="unban(u)"
                      >
                        <ShieldCheck />
                        Lever la suspension
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        v-else
                        variant="destructive"
                        @select="askBan(u)"
                      >
                        <ShieldOff />
                        Suspendre
                      </DropdownMenuItem>
                    </template>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <TablePagination
          v-model="page"
          :total="total"
          :page-size="PAGE_SIZE"
        />
      </template>
    </div>

    <Sheet v-model:open="detailOpen">
      <SheetContent>
        <AdminUserDetail
          v-if="selected"
          :user="selected"
          :busy="busy"
          @impersonate="impersonate(selected)"
          @ban="askBan(selected)"
          @unban="unban(selected)"
          @reset-two-factor="askReset(selected)"
          @delete="askDelete(selected)"
          @export="exportData(selected)"
        />
      </SheetContent>
    </Sheet>

    <ConfirmDialog
      v-model:open="resetOpen"
      :title="`Réinitialiser la double authentification de ${resetTarget?.email ?? ''} ?`"
      description="L'application d'authentification et toutes les passkeys de ce compte seront supprimées, et ses sessions fermées. Si son organisation l'exige, il devra reconfigurer un second facteur à sa prochaine connexion. L'action est enregistrée dans le journal."
      confirm-label="Réinitialiser"
      destructive
      :loading="busy"
      @confirm="confirmReset"
    />

    <ConfirmDialog
      v-model:open="banOpen"
      :title="`Suspendre ${banTarget?.email ?? ''} ?`"
      description="Toutes ses sessions seront fermées et il ne pourra plus se connecter tant que la suspension n'est pas levée."
      confirm-label="Suspendre"
      destructive
      :loading="busy"
      @confirm="confirmBan"
    >
      <FormField
        v-model="banReason"
        label="Motif (facultatif)"
        placeholder="Visible dans le détail de l'utilisateur"
      />
    </ConfirmDialog>

    <ConfirmDialog
      v-model:open="deleteOpen"
      :title="`Supprimer le compte ${deleteTarget?.email ?? ''} ?`"
      description="Le compte, ses sessions, ses moyens de connexion et ses adhésions aux organisations seront définitivement supprimés. L'utilisateur sera prévenu par email. Impossible s'il est le seul gérant d'une organisation."
      confirm-label="Supprimer définitivement"
      destructive
      :loading="busy || deleteConfirm.trim().toLowerCase() !== deleteTarget?.email.toLowerCase()"
      @confirm="confirmDelete"
    >
      <FormField
        v-model="deleteConfirm"
        label="Tapez l'email du compte pour confirmer"
        autocomplete="off"
      />
    </ConfirmDialog>
  </div>
</template>
