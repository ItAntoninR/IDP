<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
</script>

<template>
  <div data-slot="dialog-footer" :class="cn('bg-muted/50 -mx-6 -mb-6 mt-1 flex flex-col-reverse gap-2 border-t px-6 py-4 sm:flex-row sm:justify-end', props.class)">
    <slot />
  </div>
</template>
