<script setup lang="ts">
definePageMeta({ layout: "admin", middleware: "admin" });
useHead({ title: "Journal d'audit" });
</script>

<template>
  <PageHeader title="Journal d'audit" description="Les actions sensibles faites par les admins et les gérants, dans toutes les organisations." />
  <AuditLogTable endpoint="/api/admin/audit" />
</template>
