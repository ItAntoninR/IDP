<script setup lang="ts">
import { toast } from "vue-sonner";
import { authClient } from "~/lib/auth-client";
import { errorMessage } from "~/lib/errors";
import { formatDate } from "~/lib/labels";

interface SessionRow {
  id: string;
  token: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  createdAt: string | Date;
  expiresAt: string | Date;
}

const current = authClient.useSession();
const sessions = ref<SessionRow[] | null>(null);

async function load() {
  const res = await authClient.listSessions();
  if (res.error) return toast.error(errorMessage(res.error));
  sessions.value = res.data as unknown as SessionRow[];
}

async function revoke(token: string) {
  const res = await authClient.revokeSession({ token });
  if (res.error) return toast.error(errorMessage(res.error));
  load();
}

async function revokeOthers() {
  const res = await authClient.revokeOtherSessions();
  if (res.error) return toast.error(errorMessage(res.error));
  toast.success("Les autres sessions ont été fermées.");
  load();
}

onMounted(load);
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Sessions actives</CardTitle>
      <CardAction v-if="sessions && sessions.length > 1">
        <Button variant="outline" size="sm" @click="revokeOthers">Fermer les autres sessions</Button>
      </CardAction>
    </CardHeader>
    <CardContent>
      <PageLoader v-if="!sessions" />
      <p v-else-if="!sessions.length" class="text-muted-foreground text-sm">Aucune session à afficher.</p>
      <ul v-else class="divide-y">
        <li v-for="s in sessions" :key="s.id" class="flex flex-wrap items-center justify-between gap-3 py-3">
          <div class="min-w-0">
            <p class="flex items-center gap-2 truncate text-sm font-medium">
              {{ s.userAgent || "Appareil inconnu" }}
              <Badge v-if="s.id === current.data?.session.id" variant="success">Cette session</Badge>
            </p>
            <p class="text-muted-foreground text-xs">
              {{ s.ipAddress ?? "IP inconnue" }} · ouverte le {{ formatDate(s.createdAt) }} · expire le {{ formatDate(s.expiresAt) }}
            </p>
          </div>
          <Button v-if="s.id !== current.data?.session.id" variant="ghost" size="sm" @click="revoke(s.token)">Fermer</Button>
        </li>
      </ul>
    </CardContent>
  </Card>
</template>
