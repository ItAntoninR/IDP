<script setup lang="ts">
definePageMeta({ middleware: "auth" });
useHead({ title: "Activité" });

const { org, error, load } = useManagedOrganization();

onMounted(load);
</script>

<template>
  <div class="space-y-6">
    <FormAlert
      v-if="error"
      :message="error"
    />

    <PageLoader v-else-if="!org" />

    <template v-else>
      <PageHeader
        title="Activité"
        :description="`Les actions faites dans ${org.name} : invitations, rôles, membres, réglages.`"
      />

      <AuditLogTable
        endpoint="/api/account/organization/audit"
        organization-scope
      />
    </template>
  </div>
</template>
