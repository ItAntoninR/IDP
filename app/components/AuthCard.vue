<script setup lang="ts">
defineProps<{ title: string; description?: string }>();
</script>

<template>
  <section class="space-y-6">
    <header class="space-y-1.5">
      <h1 class="text-2xl font-semibold tracking-tight">{{ title }}</h1>

      <p
        v-if="description"
        class="text-muted-foreground text-sm"
      >
        {{ description }}
      </p>
    </header>

    <div class="space-y-5">
      <slot />
    </div>
  </section>
</template>
