<script setup lang="ts">
definePageMeta({ middleware: "auth" });
useHead({ title: "Paramètres" });

const { org, rights, insights, appLabels, error, load, refresh } = useManagedOrganization();
const { refresh: refreshContext } = useAccountContext();

async function onProfileChanged() {
  await Promise.all([refresh(), refreshContext()]);
}

onMounted(load);
</script>

<template>
  <FormAlert v-if="error" :message="error" />
  <PageLoader v-else-if="!org || !rights" />
  <template v-else>
    <PageHeader title="Paramètres" :description="`Réglages de ${org.name}.`" />
    <OrgProfileCard :org="org" :app-labels="appLabels" :editable="rights.settings" @changed="onProfileChanged" />
    <OrgSecurityCard v-if="rights.settings" :org="org" :stats="insights?.stats ?? null" @changed="refresh" />
  </template>
</template>
