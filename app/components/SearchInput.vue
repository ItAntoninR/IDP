<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { Search, X } from "lucide-vue-next";
import { cn } from "@/lib/utils";

const model = defineModel<string>({ default: "" });
const props = defineProps<{ placeholder?: string; class?: HTMLAttributes["class"] }>();
</script>

<template>
  <div :class="cn('relative w-full sm:max-w-xs', props.class)">
    <Search class="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />

    <Input
      v-model="model"
      :placeholder="placeholder ?? 'Rechercher…'"
      :aria-label="placeholder ?? 'Rechercher'"
      class="pr-8 pl-9"
    />

    <button
      v-if="model"
      type="button"
      class="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer rounded p-0.5"
      aria-label="Effacer la recherche"
      @click="model = ''"
    >
      <X class="size-3.5" />
    </button>
  </div>
</template>
