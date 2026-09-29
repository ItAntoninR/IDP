<script setup lang="ts">
import { CircleAlert, CircleCheck, Info } from "lucide-vue-next";

defineProps<{ message?: string | null; tone?: "error" | "success" | "info" }>();
</script>

<template>
  <Alert v-if="message" :variant="tone === 'success' ? 'success' : tone === 'info' ? 'info' : 'destructive'">
    <CircleCheck v-if="tone === 'success'" />
    <Info v-else-if="tone === 'info'" />
    <CircleAlert v-else />
    <AlertDescription>{{ message }}</AlertDescription>
  </Alert>
</template>
