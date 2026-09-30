<script setup lang="ts">
import { Check, ChevronRight, LoaderCircle } from "lucide-vue-next";
import { authClient } from "~/lib/auth-client";
import { errorMessage } from "~/lib/errors";
import type { MyOrganization } from "~/lib/api";
import { isOAuthFlow, safeRedirect } from "~/lib/oauth";
import { roleLabel } from "~/lib/labels";

definePageMeta({ layout: "auth", middleware: "auth" });
useHead({ title: "Choisir une organisation" });

const route = useRoute();
const { context, switchOrganization } = useAccountContext();
const oauth = isOAuthFlow();
const resource = oauth ? new URLSearchParams(window.location.search).get("resource") : null;

const orgs = ref<MyOrganization[] | null>(null);
const appLabel = ref<string | null>(null);
const error = ref("");
const pending = ref<string | null>(null);

const description = computed(() =>
  appLabel.value
    ? `Pour quelle organisation voulez-vous ouvrir ${appLabel.value} ?`
    : "Vous agissez toujours pour une seule organisation à la fois.",
);

async function continueAuthorization() {
  const res = await authClient.$fetch<{ url?: string; redirect?: boolean }>("/oauth2/continue", {
    method: "POST",
    body: { postLogin: true, oauth_query: window.location.search.slice(1) },
  });
  if (res.error) throw res.error;
  if (res.data?.url && !res.data.redirect) window.location.href = res.data.url;
}

async function choose(organizationId: string) {
  pending.value = organizationId;
  error.value = "";
  try {
    await switchOrganization(organizationId);
    if (oauth) await continueAuthorization();
    else await navigateTo(safeRedirect(route.query.callbackURL, "/"), { replace: true });
  } catch (e) {
    pending.value = null;
    error.value = errorMessage(e);
  }
}

onMounted(async () => {
  try {
    const res = await $fetch<{ organizations: MyOrganization[]; app?: { label: string } }>("/api/account/organizations", {
      query: resource ? { resource } : {},
    });
    orgs.value = res.organizations;
    appLabel.value = res.app?.label ?? null;
    if (oauth && res.organizations.length === 1) await choose(res.organizations[0]!.id);
  } catch (e) {
    error.value = errorMessage((e as { data?: unknown }).data ?? e);
  }
});
</script>

<template>
  <AuthCard title="Choisissez une organisation" :description="description">
    <FormAlert :message="error" />
    <PageLoader v-if="!orgs || (oauth && orgs.length === 1)" />
    <p v-else-if="!orgs.length" class="text-muted-foreground text-center text-sm">
      {{ appLabel ? `Aucune de vos organisations ne vous donne accès à ${appLabel}.` : "Vous n'appartenez à aucune organisation." }}
    </p>
    <div v-else class="space-y-2">
      <button
        v-for="org in orgs"
        :key="org.id"
        :disabled="pending !== null"
        class="hover:bg-accent flex w-full cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors disabled:opacity-60"
        @click="choose(org.id)"
      >
        <span class="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg border font-semibold">
          {{ org.name[0]?.toUpperCase() }}
        </span>
        <span class="min-w-0 flex-1">
          <span class="block truncate font-medium">{{ org.name }}</span>
          <span class="text-muted-foreground text-xs">
            {{ roleLabel(org.role) }} · {{ org.apps.map((a) => a.label).join(", ") || "Aucune application" }}
          </span>
        </span>
        <LoaderCircle v-if="pending === org.id" class="text-muted-foreground size-4 animate-spin" />
        <Check v-else-if="!oauth && context?.active?.id === org.id" class="size-4" />
        <ChevronRight v-else class="text-muted-foreground size-4" />
      </button>
    </div>
    <p class="text-muted-foreground text-center text-xs">
      Les données de chaque organisation restent séparées. Vous pourrez changer d'organisation à tout moment.
    </p>
  </AuthCard>
</template>
