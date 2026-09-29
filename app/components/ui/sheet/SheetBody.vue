<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
</script>

<template>
  <div data-slot="sheet-body" :class="cn('flex-1 space-y-8 p-6', props.class)">
    <slot />
  </div>
</template>
