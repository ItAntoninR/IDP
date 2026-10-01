<script setup lang="ts">
definePageMeta({ middleware: "auth" });
useHead({ title: "Sessions" });
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Sessions"
      description="Les appareils connectés à votre compte. Déconnectez ceux que vous ne reconnaissez pas."
    />

    <AccountSessionsCard />
  </div>
</template>
