<script setup lang="ts">
definePageMeta({ middleware: "auth" });
useHead({ title: "Sessions" });
</script>

<template>
  <PageHeader title="Sessions" description="Les appareils connectés à votre compte. Déconnectez ceux que vous ne reconnaissez pas." />
  <AccountSessionsCard />
</template>
