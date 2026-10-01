<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { useVModel } from "@vueuse/core";
import { ChevronDown } from "lucide-vue-next";
import { cn } from "@/lib/utils";

const props = defineProps<{ modelValue?: string; class?: HTMLAttributes["class"] }>();
const emits = defineEmits<{ (e: "update:modelValue", payload: string): void }>();
const modelValue = useVModel(props, "modelValue", emits, { passive: true });
</script>

<template>
  <div class="relative w-full">
    <select
      v-model="modelValue"
      data-slot="native-select"
      :class="
        cn(
          'border-input h-9 w-full appearance-none rounded-md border bg-white px-3 py-1 pr-8 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
          props.class,
        )
      "
    >
      <slot />
    </select>

    <ChevronDown class="text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2" />
  </div>
</template>
