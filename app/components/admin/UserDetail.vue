<script setup lang="ts">
import { Download, KeyRound, LogIn, ShieldCheck, ShieldOff, Trash2 } from "lucide-vue-next";
import { authClient, isGlobalAdmin } from "~/lib/auth-client";
import { formatDate } from "~/lib/labels";
import type { AdminUser } from "~/lib/types";

const props = defineProps<{ user: AdminUser; busy?: boolean }>();
const emit = defineEmits<{ impersonate: []; ban: []; unban: []; resetTwoFactor: []; delete: []; export: [] }>();

const session = authClient.useSession();
const isSelf = computed(() => session.value.data?.user.id === props.user.id);
const isAdmin = computed(() => isGlobalAdmin(props.user));
const initials = computed(() =>
  (props.user.name || props.user.email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join(""),
);
</script>

<template>
  <div class="flex flex-1 flex-col">
    <SheetHeader>
      <div class="flex items-center gap-3">
        <span class="bg-muted flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
          {{ initials }}
        </span>

        <div class="min-w-0">
          <SheetTitle class="truncate">{{ user.name || user.email }}</SheetTitle>

          <SheetDescription class="truncate">{{ user.email }}</SheetDescription>
        </div>
      </div>

      <div class="flex flex-wrap gap-1 pt-2">
        <Badge
          v-if="user.deletedAt"
          variant="outline"
        >
          Supprimé
        </Badge>

        <Badge
          v-if="isAdmin"
          variant="warning"
        >
          Admin
        </Badge>

        <Badge
          v-if="user.banned && !user.deletedAt"
          variant="destructive"
        >
          Suspendu
        </Badge>

        <Badge
          v-if="!user.emailVerified && !user.deletedAt"
          variant="outline"
        >
          Email non vérifié
        </Badge>

        <Badge
          v-if="isSelf"
          variant="secondary"
        >
          Vous
        </Badge>
      </div>
    </SheetHeader>

    <SheetBody>
      <section class="space-y-3">
        <h3 class="text-sm font-semibold">Informations</h3>

        <dl class="divide-y rounded-lg border text-sm">
          <div class="flex justify-between gap-4 px-3 py-2.5">
            <dt class="text-muted-foreground">Rôle global</dt>

            <dd>{{ isAdmin ? "Administrateur" : "Utilisateur" }}</dd>
          </div>

          <div class="flex justify-between gap-4 px-3 py-2.5">
            <dt class="text-muted-foreground">Email vérifié</dt>

            <dd>{{ user.emailVerified ? "Oui" : "Non" }}</dd>
          </div>

          <div class="flex justify-between gap-4 px-3 py-2.5">
            <dt class="text-muted-foreground">Double authentification</dt>

            <dd>
              <span
                v-if="isAdmin"
                class="text-muted-foreground text-xs"
              >
                Gérée par Authentik
              </span>

              <span
                v-else
                class="flex items-center gap-2"
              >
                <TwoFactorBadge :enabled="user.twoFactorEnabled === true || user.hasPasskey === true" />

                <span
                  v-if="user.twoFactorEnabled || user.hasPasskey"
                  class="text-muted-foreground text-xs"
                >
                  {{
                    [user.twoFactorEnabled && "application", user.hasPasskey && "passkey"].filter(Boolean).join(" + ")
                  }}
                </span>
              </span>
            </dd>
          </div>

          <div class="flex justify-between gap-4 px-3 py-2.5">
            <dt class="text-muted-foreground">Inscrit le</dt>

            <dd>{{ formatDate(user.createdAt) }}</dd>
          </div>

          <div
            v-if="!user.deletedAt"
            class="flex justify-between gap-4 px-3 py-2.5"
          >
            <dt class="text-muted-foreground">Dernière connexion</dt>

            <dd>{{ formatDate(user.lastActiveAt) }}</dd>
          </div>

          <div class="flex justify-between gap-4 px-3 py-2.5">
            <dt class="text-muted-foreground">Identifiant</dt>

            <dd class="truncate font-mono text-xs">{{ user.id }}</dd>
          </div>
        </dl>
      </section>

      <section
        v-if="user.deletedAt"
        class="space-y-2 rounded-lg border p-3 text-sm"
      >
        <p class="font-medium">Compte supprimé le {{ formatDate(user.deletedAt) }}</p>

        <p class="text-muted-foreground">
          Les données personnelles ont été effacées. L'identifiant est conservé pour les applications. L'archive de
          réquisition se consulte depuis la page Archives.
        </p>
      </section>

      <section
        v-else-if="user.banned"
        class="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm"
      >
        <p class="font-medium text-red-800">Compte suspendu</p>

        <p class="text-red-700">
          {{ user.banReason || "Sans motif" }} ·
          {{ user.banExpires ? `jusqu'au ${formatDate(user.banExpires)}` : "suspension définitive" }}
        </p>
      </section>

      <section
        v-if="!user.deletedAt"
        class="space-y-3"
      >
        <h3 class="text-sm font-semibold">Données personnelles</h3>

        <div class="flex items-center justify-between gap-4 rounded-lg border p-3">
          <div>
            <p class="text-sm font-medium">Exporter les données</p>

            <p class="text-muted-foreground text-xs">
              Pour une demande d'accès (RGPD). Fichier JSON, tracé dans le journal, l'utilisateur est prévenu par email.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            :disabled="busy"
            @click="emit('export')"
          >
            <Download />
            Exporter
          </Button>
        </div>
      </section>

      <section
        v-if="!isSelf && !user.deletedAt"
        class="space-y-3"
      >
        <h3 class="text-sm font-semibold">Actions</h3>

        <div class="divide-y rounded-lg border">
          <div
            v-if="!isAdmin && !user.banned"
            class="flex items-center justify-between gap-4 p-3"
          >
            <div>
              <p class="text-sm font-medium">Se connecter en tant que</p>

              <p class="text-muted-foreground text-xs">Pour le support. L'action est tracée dans le journal.</p>
            </div>

            <Button
              variant="outline"
              size="sm"
              :disabled="busy"
              @click="emit('impersonate')"
            >
              <LogIn />
              Se connecter
            </Button>
          </div>

          <div
            v-if="!isAdmin && (user.twoFactorEnabled || user.hasPasskey)"
            class="flex items-center justify-between gap-4 p-3"
          >
            <div>
              <p class="text-sm font-medium">Réinitialiser la double authentification</p>

              <p class="text-muted-foreground text-xs">
                Si l'utilisateur a perdu l'accès à ses appareils. Vérifiez son identité avant.
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              :disabled="busy"
              @click="emit('resetTwoFactor')"
            >
              <KeyRound />
              Réinitialiser
            </Button>
          </div>

          <div
            v-if="user.banned"
            class="flex items-center justify-between gap-4 p-3"
          >
            <div>
              <p class="text-sm font-medium">Lever la suspension</p>

              <p class="text-muted-foreground text-xs">L'utilisateur pourra de nouveau se connecter.</p>
            </div>

            <Button
              variant="outline"
              size="sm"
              :disabled="busy"
              @click="emit('unban')"
            >
              <ShieldCheck />
              Lever
            </Button>
          </div>

          <div
            v-else
            class="flex items-center justify-between gap-4 p-3"
          >
            <div>
              <p class="text-sm font-medium text-red-700">Suspendre le compte</p>

              <p class="text-muted-foreground text-xs">Ferme toutes ses sessions et bloque la connexion.</p>
            </div>

            <Button
              variant="destructive"
              size="sm"
              :disabled="busy"
              @click="emit('ban')"
            >
              <ShieldOff />
              Suspendre
            </Button>
          </div>

          <div
            v-if="!isAdmin"
            class="flex items-center justify-between gap-4 p-3"
          >
            <div>
              <p class="text-sm font-medium text-red-700">Supprimer le compte</p>

              <p class="text-muted-foreground text-xs">
                À la demande de l'utilisateur (RGPD). Définitif, l'utilisateur est prévenu par email.
              </p>
            </div>

            <Button
              variant="destructive"
              size="sm"
              :disabled="busy"
              @click="emit('delete')"
            >
              <Trash2 />
              Supprimer
            </Button>
          </div>
        </div>
      </section>
    </SheetBody>
  </div>
</template>
