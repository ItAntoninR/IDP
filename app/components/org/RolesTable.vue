<script setup lang="ts">
import { toast } from "vue-sonner";
import { Ellipsis, KeyRound, Lock, Pencil, Plus, Trash2 } from "lucide-vue-next";
import { authClient } from "~/lib/auth-client";
import { errorMessage } from "~/lib/errors";
import type { DynamicRole, ManagedOrganization } from "~/lib/org";
import type { PermissionState } from "~/lib/types";

const props = defineProps<{ org: ManagedOrganization; roles: DynamicRole[]; roleCounts: Record<string, number> }>();
const emit = defineEmits<{ changed: [] }>();

const editing = ref<DynamicRole | "new" | null>(null);
const editorOpen = ref(false);
const target = ref<DynamicRole | null>(null);
const deleteOpen = ref(false);
const busy = ref(false);
const removed = ref(new Set<string>());

const allowedApps = computed(() => props.org.apps);
const visibleRoles = computed(() => props.roles.filter((r) => !removed.value.has(r.id)));
const membersWith = (role: string) => props.roleCounts[role] ?? 0;

watch(
  () => props.roles,
  () => (removed.value = new Set()),
);

function openEditor(role: DynamicRole | "new") {
  editing.value = role;
  editorOpen.value = true;
}

async function save(name: string, permission: PermissionState): Promise<boolean> {
  const current = editing.value;
  const res =
    current === "new"
      ? await authClient.organization.createRole({ role: name, permission, organizationId: props.org.id })
      : await authClient.organization.updateRole({
          roleId: current!.id,
          organizationId: props.org.id,
          data: { permission, ...(name !== current!.role ? { roleName: name } : {}) },
        });

  if (res.error) {
    toast.error(errorMessage(res.error));

    return false;
  }

  toast.success(current === "new" ? "Rôle créé." : "Rôle mis à jour.");
  emit("changed");

  return true;
}

function askDelete(role: DynamicRole) {
  target.value = role;
  deleteOpen.value = true;
}

async function remove() {
  const role = target.value;

  if (!role) return;
  busy.value = true;
  const res = await authClient.organization.deleteRole({ roleId: role.id, organizationId: props.org.id });

  busy.value = false;
  if (res.error) return toast.error(errorMessage(res.error));
  removed.value = new Set([...removed.value, role.id]);
  deleteOpen.value = false;
  toast.success("Rôle supprimé.");
  emit("changed");
}
</script>

<template>
  <div>
    <div class="bg-card overflow-hidden rounded-xl border shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b p-3 pl-4">
        <p class="text-muted-foreground text-sm">
          Les permissions sont limitées aux applications autorisées pour l'organisation.
        </p>

        <Button
          size="sm"
          variant="outline"
          @click="openEditor('new')"
        >
          <Plus />
          Nouveau rôle
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow class="hover:bg-transparent">
            <TableHead class="pl-4">Rôle</TableHead>

            <TableHead>Permissions</TableHead>

            <TableHead class="hidden md:table-cell">Membres</TableHead>

            <TableHead class="w-12" />
          </TableRow>
        </TableHeader>

        <TableBody>
          <TableRow
            v-for="fixed in [
              { id: 'owner', name: 'Gérant', text: 'Gestion complète et accès à toutes les applications autorisées.' },
              { id: 'member', name: 'Membre', text: 'Aucune permission d\'application.' },
            ]"
            :key="fixed.id"
          >
            <TableCell class="pl-4">
              <div class="flex items-center gap-3">
                <span class="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg">
                  <Lock class="text-muted-foreground size-4" />
                </span>

                <div>
                  <p class="font-medium">{{ fixed.name }}</p>

                  <p class="text-muted-foreground text-xs">Rôle par défaut</p>
                </div>
              </div>
            </TableCell>

            <TableCell class="text-muted-foreground text-xs whitespace-normal">{{ fixed.text }}</TableCell>

            <TableCell class="text-muted-foreground hidden tabular-nums md:table-cell">
              {{ membersWith(fixed.id) }}
            </TableCell>

            <TableCell />
          </TableRow>

          <TableRow
            v-for="r in visibleRoles"
            :key="r.id"
            class="cursor-pointer"
            @click="openEditor(r)"
          >
            <TableCell class="pl-4">
              <div class="flex items-center gap-3">
                <span class="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg">
                  <KeyRound class="size-4" />
                </span>

                <p class="font-medium">{{ r.role }}</p>
              </div>
            </TableCell>

            <TableCell class="whitespace-normal"><PermissionSummary :permission="r.permission" /></TableCell>

            <TableCell class="text-muted-foreground hidden tabular-nums md:table-cell">
              {{ membersWith(r.role) }}
            </TableCell>

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
                    :aria-label="`Actions pour le rôle ${r.role}`"
                  >
                    <Ellipsis />
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent>
                  <DropdownMenuLabel>{{ r.role }}</DropdownMenuLabel>

                  <DropdownMenuItem @select="openEditor(r)">
                    <Pencil />
                    Modifier
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    variant="destructive"
                    :disabled="membersWith(r.role) > 0"
                    @select="askDelete(r)"
                  >
                    <Trash2 />
                    {{ membersWith(r.role) > 0 ? "Attribué à des membres" : "Supprimer" }}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <Sheet v-model:open="editorOpen">
      <SheetContent>
        <template v-if="editing !== null">
          <SheetHeader>
            <div class="flex items-center gap-3">
              <span class="bg-muted flex size-11 shrink-0 items-center justify-center rounded-xl">
                <KeyRound class="size-5" />
              </span>

              <div>
                <SheetTitle>{{ editing === "new" ? "Nouveau rôle" : editing.role }}</SheetTitle>

                <SheetDescription>
                  {{
                    editing === "new"
                      ? "Choisissez ce que ce rôle permet dans chaque application."
                      : `${membersWith(editing.role)} membre(s) ont ce rôle.`
                  }}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <SheetBody>
            <OrgRoleEditor
              :key="editing === 'new' ? 'new' : editing.id"
              :initial="editing === 'new' ? undefined : editing"
              :allowed-apps="allowedApps"
              :save="save"
              @close="editorOpen = false"
            />
          </SheetBody>
        </template>
      </SheetContent>
    </Sheet>

    <ConfirmDialog
      v-model:open="deleteOpen"
      :title="`Supprimer le rôle « ${target?.role ?? ''} » ?`"
      description="Cette action est définitive."
      confirm-label="Supprimer"
      destructive
      :loading="busy"
      @confirm="remove"
    />
  </div>
</template>
