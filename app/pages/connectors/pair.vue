<script setup lang="ts">
import { CircleCheck } from "lucide-vue-next";
import { errorMessage } from "~/lib/errors";
import type { PairingOrganization } from "~/lib/org";

definePageMeta({ layout: "auth", middleware: "auth" });
useHead({ title: "Appairer une machine" });

interface PairingPreview {
  userCode: string;
  name: string | null;
  expiresAt: string;
}

const route = useRoute();
const code = ref(typeof route.query.code === "string" ? route.query.code : "");
const organizationId = ref("");
const name = ref("");
const organizations = ref<PairingOrganization[] | null>(null);
const preview = ref<PairingPreview | null>(null);
const error = ref("");
const busy = ref(false);
const outcome = ref<"approved" | "denied" | null>(null);

const normalizedCode = computed(() => code.value.toUpperCase().replace(/[^A-Z]/g, ""));
const organizationOptions = computed(() => (organizations.value ?? []).map((o) => ({ value: o.id, label: o.name })));
const organizationName = computed(() => organizations.value?.find((o) => o.id === organizationId.value)?.name ?? "");
const ready = computed(() => normalizedCode.value.length === 8 && !!organizationId.value && !!name.value.trim());

const fail = (e: unknown) => {
  error.value = errorMessage((e as { data?: unknown }).data ?? e);
};

async function lookup() {
  preview.value = null;
  if (normalizedCode.value.length !== 8) return;
  try {
    const res = await $fetch<{ pairing: PairingPreview }>("/api/account/connectors/pairing", {
      query: { code: normalizedCode.value },
    });

    preview.value = res.pairing;
    if (!name.value && res.pairing.name) name.value = res.pairing.name;
    error.value = "";
  } catch (e) {
    fail(e);
  }
}

watch(normalizedCode, (value, previous) => {
  if (value.length === 8 && value !== previous) lookup();
});

async function decide(decision: "approve" | "deny") {
  busy.value = true;
  error.value = "";
  try {
    await $fetch(`/api/account/connectors/pairing/${decision}`, {
      method: "POST",
      body: {
        userCode: normalizedCode.value,
        organizationId: organizationId.value,
        ...(decision === "approve" ? { name: name.value.trim() } : {}),
      },
    });
    outcome.value = decision === "approve" ? "approved" : "denied";
  } catch (e) {
    fail(e);
  } finally {
    busy.value = false;
  }
}

onMounted(async () => {
  try {
    const res = await $fetch<{ organizations: PairingOrganization[] }>("/api/account/connectors/organizations");

    organizations.value = res.organizations;
    if (res.organizations.length === 1) organizationId.value = res.organizations[0]!.id;
    if (normalizedCode.value.length === 8) await lookup();
  } catch (e) {
    fail(e);
  }
});
</script>

<template>
  <AuthCard
    title="Appairer une machine"
    description="Saisissez le code affiché par le connecteur pour l'autoriser à importer des données dans le Data hub."
  >
    <PageLoader v-if="!organizations && !error" />

    <div
      v-else-if="outcome"
      class="space-y-4 text-center"
    >
      <CircleCheck class="mx-auto size-10 text-emerald-600" />

      <p class="text-sm">
        {{
          outcome === "approved"
            ? `La machine « ${name.trim()} » est appairée à ${organizationName}. Elle va récupérer son identifiant d'elle-même dans quelques secondes.`
            : "L'appairage a été refusé. La machine ne recevra aucun accès."
        }}
      </p>

      <Button
        as-child
        variant="outline"
      >
        <NuxtLink to="/">Retour au tableau de bord</NuxtLink>
      </Button>
    </div>

    <template v-else>
      <FormAlert :message="error" />

      <p
        v-if="organizations && !organizations.length"
        class="text-muted-foreground text-sm"
      >
        Aucune de vos organisations ne vous permet d'appairer un connecteur : il faut la permission « Connecteurs :
        Créer / appairer » et l'accès au Data hub. Demandez-la à un gérant.
      </p>

      <form
        v-else-if="organizations"
        class="grid gap-5"
        @submit.prevent="decide('approve')"
      >
        <FormField
          v-model="code"
          label="Code de la machine"
          placeholder="XXXX-XXXX"
          autocomplete="off"
          hint="Le code est valable 10 minutes."
          required
        />

        <p
          v-if="preview"
          class="text-muted-foreground -mt-3 text-xs"
        >
          Code reconnu{{ preview.name ? ` : la machine se présente comme « ${preview.name} »` : "" }}.
        </p>

        <div class="grid gap-2">
          <Label for="pair-organization">Organisation</Label>

          <AppSelect
            id="pair-organization"
            v-model="organizationId"
            :options="organizationOptions"
            placeholder="Choisir une organisation"
          />
        </div>

        <FormField
          v-model="name"
          label="Nom du connecteur"
          placeholder="Ex. : Serveur de l'agence de Lyon"
          hint="Pour reconnaître la machine dans la liste des connecteurs."
          required
        />

        <div class="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            :disabled="busy || normalizedCode.length !== 8 || !organizationId"
            @click="decide('deny')"
          >
            Refuser
          </Button>

          <Button
            type="submit"
            :disabled="busy || !ready"
          >
            Autoriser la machine
          </Button>
        </div>

        <p class="text-muted-foreground text-xs">
          La machine pourra uniquement importer des données dans le Data hub pour l'organisation choisie. Aucun secret
          n'est affiché ni à recopier.
        </p>
      </form>
    </template>
  </AuthCard>
</template>
