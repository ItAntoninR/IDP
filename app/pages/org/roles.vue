<script setup lang="ts">
definePageMeta({ middleware: "auth" });
useHead({ title: "Rôles" });

const { org, roles, rights, insights, error, load, refresh } = useManagedOrganization();

onMounted(load);
</script>

<template>
  <div class="space-y-6">
    <FormAlert
      v-if="error"
      :message="error"
    />

    <PageLoader v-else-if="!org || !rights" />

    <template v-else>
      <PageHeader
        title="Rôles"
        :description="`Ce que chaque membre de ${org.name} peut faire dans vos applications.`"
      />

      <OrgRolesTable
        v-if="rights.roles"
        :org="org"
        :roles="roles"
        :role-counts="insights?.roleCounts ?? {}"
        @changed="refresh"
      />

      <FormAlert
        v-else
        tone="info"
        message="Vous n'avez pas le droit de gérer les rôles de cette organisation."
      />
    </template>
  </div>
</template>
