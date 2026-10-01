<script setup lang="ts">
import { watchDebounced } from "@vueuse/core";
import { toast } from "vue-sonner";
import { Archive, Download } from "lucide-vue-next";
import { errorMessage } from "~/lib/errors";
import { formatDate } from "~/lib/labels";

definePageMeta({ layout: "admin", middleware: "admin" });
useHead({ title: "Archives" });

interface ArchiveRow {
  id: string;
  name: string;
  email: string;
  reason: "self" | "admin" | "inactivity";
  deletedAt: string;
  expiresAt: string;
}

const REASONS: Record<ArchiveRow["reason"], string> = {
  self: "À la demande de la personne",
  admin: "Par l'équipe",
  inactivity: "Inactivité (3 ans)",
};

const email = ref("");
const archives = ref<ArchiveRow[] | null>(null);
const busy = ref(false);

async function search() {
  if (email.value.trim().length < 3) return (archives.value = null);
  try {
    archives.value = (
      await $fetch<{ archives: ArchiveRow[] }>("/api/admin/archives", { query: { email: email.value.trim() } })
    ).archives;
  } catch (e) {
    toast.error(errorMessage((e as { data?: unknown }).data ?? e));
  }
}

async function download(row: ArchiveRow) {
  busy.value = true;
  try {
    const res = await fetch(`/api/admin/archives/${encodeURIComponent(row.id)}/export`, {
      headers: { accept: "application/json" },
    });

    if (!res.ok) throw await res.json().catch(() => ({ status: res.status }));
    const filename = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "archive.json";
    const url = URL.createObjectURL(await res.blob());

    Object.assign(document.createElement("a"), { href: url, download: filename }).click();
    URL.revokeObjectURL(url);
    toast.success("Archive exportée. La consultation est tracée dans le journal.");
  } catch (e) {
    toast.error(errorMessage(e));
  } finally {
    busy.value = false;
  }
}

watchDebounced(email, search, { debounce: 300 });
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Archives"
      description="Comptes supprimés, conservés 1 an pour répondre aux réquisitions des autorités. Chaque export est tracé dans le journal."
    />

    <div class="bg-card overflow-hidden rounded-xl border shadow-sm">
      <div class="border-b p-3">
        <SearchInput
          v-model="email"
          placeholder="Rechercher par email (3 caractères minimum)"
        />
      </div>

      <div
        v-if="archives === null"
        class="text-muted-foreground px-6 py-14 text-center text-sm"
      >
        Saisissez l'email du compte recherché. Les archives ne sont pas consultables sans recherche.
      </div>

      <div
        v-else-if="!archives.length"
        class="flex flex-col items-center gap-2 px-6 py-14 text-center"
      >
        <span class="bg-muted flex size-10 items-center justify-center rounded-xl">
          <Archive class="text-muted-foreground size-5" />
        </span>

        <p class="font-medium">Aucune archive</p>

        <p class="text-muted-foreground text-sm">Aucun compte supprimé ne correspond, ou son archive a expiré.</p>
      </div>

      <Table v-else>
        <TableHeader>
          <TableRow class="hover:bg-transparent">
            <TableHead class="pl-4">Compte</TableHead>

            <TableHead>Motif</TableHead>

            <TableHead class="hidden md:table-cell">Supprimé le</TableHead>

            <TableHead class="hidden md:table-cell">Effacé le</TableHead>

            <TableHead class="w-12" />
          </TableRow>
        </TableHeader>

        <TableBody>
          <TableRow
            v-for="a in archives"
            :key="a.id"
          >
            <TableCell class="pl-4">
              <p class="font-medium">{{ a.name }}</p>

              <p class="text-muted-foreground text-xs">{{ a.email }}</p>
            </TableCell>

            <TableCell class="text-sm">{{ REASONS[a.reason] ?? a.reason }}</TableCell>

            <TableCell class="text-muted-foreground hidden md:table-cell">{{ formatDate(a.deletedAt) }}</TableCell>

            <TableCell class="text-muted-foreground hidden md:table-cell">{{ formatDate(a.expiresAt) }}</TableCell>

            <TableCell class="pr-3 text-right">
              <Button
                variant="outline"
                size="sm"
                :disabled="busy"
                @click="download(a)"
              >
                <Download />
                Exporter
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
</template>
