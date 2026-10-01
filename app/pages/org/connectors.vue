<script setup lang="ts">
import { Cable } from "lucide-vue-next";
import { authClient } from "~/lib/auth-client";
import { errorMessage } from "~/lib/errors";

definePageMeta({ middleware: "auth" });
useHead({ title: "Connecteurs" });

const { context, load } = useAccountContext();
const rights = ref<{ create: boolean; update: boolean; delete: boolean } | null>(null);
const error = ref("");

const active = computed(() => context.value?.active ?? null);
const hasDatahub = computed(() => !!active.value?.apps.some((a) => a.id === "datahub"));

async function loadRights(organizationId: string) {
  const has = (action: string) =>
    authClient.organization
      .hasPermission({ organizationId, permissions: { connector: [action] } } as never)
      .then((r) => !!r.data?.success);
  const [create, update, remove] = await Promise.all([has("create"), has("update"), has("delete")]);

  rights.value = { create, update, delete: remove };
}

onMounted(async () => {
  try {
    const ctx = await load();

    if (!ctx.active?.canManageConnectors) return navigateTo("/", { replace: true });
    await loadRights(ctx.active.id);
  } catch (e) {
    error.value = errorMessage(e);
  }
});
</script>

<template>
  <div class="space-y-6">
    <FormAlert
      v-if="error"
      :message="error"
    />

    <PageLoader v-else-if="!active || !rights" />

    <template v-else>
      <PageHeader
        title="Connecteurs"
        :description="`Les machines qui envoient chaque jour leurs imports au Data hub pour ${active.name}.`"
      >
        <template
          v-if="rights.create && hasDatahub"
          #actions
        >
          <Button as-child>
            <NuxtLink to="/connectors/pair">
              <Cable />
              Appairer une machine
            </NuxtLink>
          </Button>
        </template>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Comment appairer une nouvelle machine ?</CardTitle>

          <CardDescription>
            Un connecteur s'identifie lui-même, sans mot de passe ni secret à copier : il ne peut qu'importer des
            données dans le Data hub, pour cette organisation uniquement.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <ol class="text-muted-foreground list-decimal space-y-1.5 pl-5 text-sm">
            <li>Installez et lancez le connecteur sur la machine du site.</li>

            <li>Il affiche un code à 8 lettres, valable 10 minutes (par exemple BDFG-HJKL).</li>

            <li>
              Ouvrez la page
              <NuxtLink
                to="/connectors/pair"
                class="text-foreground font-medium underline underline-offset-4"
              >
                Appairer une machine
              </NuxtLink>
              , saisissez ce code, choisissez l'organisation et validez.
            </li>

            <li>La machine récupère son identifiant et commence ses imports. Vous pouvez la révoquer à tout moment.</li>
          </ol>

          <p
            v-if="!hasDatahub"
            class="mt-4 text-sm"
          >
            Cette organisation n'a pas accès au Data hub : aucun connecteur ne peut y être appairé.
          </p>

          <p class="text-muted-foreground mt-4 text-xs">
            La dernière connexion correspond au dernier jeton obtenu par la machine, juste avant chacun de ses imports.
          </p>
        </CardContent>
      </Card>

      <OrgConnectorsTable
        endpoint="/api/account/organization/connectors"
        :can-rename="rights.update"
        :can-revoke="rights.delete"
      />
    </template>
  </div>
</template>
