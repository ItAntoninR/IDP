<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";

const props = defineProps<{ name: string; logoUrl?: string | null; class?: HTMLAttributes["class"] }>();
const failed = ref(false);

watch(
  () => props.logoUrl,
  () => (failed.value = false),
);
</script>

<template>
  <span
    :class="
      cn(
        'bg-muted flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border text-sm font-semibold',
        props.class,
      )
    "
  >
    <img
      v-if="logoUrl && !failed"
      :src="logoUrl"
      :alt="`Logo de ${name}`"
      class="size-full object-contain"
      @error="failed = true"
    />

    <template v-else>{{ name[0]?.toUpperCase() }}</template>
  </span>
</template>
