<script setup lang="ts">
defineProps<{ enabled: boolean; required?: boolean }>();
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 text-xs whitespace-nowrap"
    :class="enabled ? 'text-emerald-700' : required ? 'text-amber-700' : 'text-muted-foreground'"
    :title="
      enabled
        ? 'Double authentification activée'
        : required
          ? 'Obligatoire mais pas encore activée'
          : 'Double authentification non activée'
    "
  >
    <span
      class="size-1.5 rounded-full"
      :class="enabled ? 'bg-emerald-500' : required ? 'bg-amber-500' : 'bg-muted-foreground/40'"
    />
    {{ enabled ? "2FA active" : required ? "2FA à activer" : "Sans 2FA" }}
  </span>
</template>
