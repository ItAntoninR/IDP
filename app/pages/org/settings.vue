<script setup lang="ts">
definePageMeta({ middleware: "auth" });
useHead({ title: "Paramètres" });

const { org, rights, insights, appLabels, error, load, refresh } = useManagedOrganization();

onMounted(load);
</script>

<template>
  <FormAlert v-if="error" :message="error" />
  <PageLoader v-else-if="!org || !rights" />
  <template v-else>
    <PageHeader title="Paramètres" :description="`Réglages de ${org.name}.`" />
    <Card>
      <CardHeader>
        <CardTitle>Organisation</CardTitle>
        <CardDescription>Ces informations sont gérées par notre équipe.</CardDescription>
      </CardHeader>
      <CardContent>
        <dl class="divide-y rounded-lg border text-sm">
          <div class="flex justify-between gap-4 px-4 py-3">
            <dt class="text-muted-foreground">Nom</dt>
            <dd class="font-medium">{{ org.name }}</dd>
          </div>
          <div class="flex justify-between gap-4 px-4 py-3">
            <dt class="text-muted-foreground">Applications autorisées</dt>
            <dd>{{ appLabels }}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
    <OrgSecurityCard v-if="rights.settings" :org="org" :stats="insights?.stats ?? null" @changed="refresh" />
  </template>
</template>
