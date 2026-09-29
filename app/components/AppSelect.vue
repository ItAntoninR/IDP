<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { Check, ChevronDown } from "lucide-vue-next";
import {
  SelectContent,
  SelectIcon,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectViewport,
} from "reka-ui";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

defineOptions({ inheritAttrs: false });

const model = defineModel<string>({ required: true });
const props = defineProps<{
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  class?: HTMLAttributes["class"];
}>();

const selected = computed(() => props.options.find((o) => o.value === model.value));
</script>

<template>
  <SelectRoot v-model="model" :disabled="disabled">
    <SelectTrigger
      :id="id"
      :class="
        cn(
          'group border-input bg-background hover:border-foreground/20 focus-visible:border-ring focus-visible:ring-ring/50 data-[state=open]:border-ring flex h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-md border px-3 text-left text-sm shadow-xs transition-colors outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
          props.class,
        )
      "
      v-bind="$attrs"
    >
      <SelectValue :placeholder="placeholder" class="truncate data-[placeholder]:text-muted-foreground">
        {{ selected?.label ?? placeholder }}
      </SelectValue>
      <SelectIcon as-child>
        <ChevronDown class="text-muted-foreground size-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
      </SelectIcon>
    </SelectTrigger>
    <SelectPortal>
      <SelectContent
        position="popper"
        :side-offset="4"
        class="bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 z-50 max-h-72 w-(--reka-select-trigger-width) min-w-40 overflow-hidden rounded-lg border shadow-lg"
      >
        <SelectViewport class="p-1">
          <SelectItem
            v-for="option in options"
            :key="option.value"
            :value="option.value"
            class="data-[highlighted]:bg-accent relative flex cursor-pointer items-start gap-2 rounded-md py-2 pr-8 pl-2.5 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
          >
            <span class="flex min-w-0 flex-col">
              <SelectItemText class="truncate">{{ option.label }}</SelectItemText>
              <span v-if="option.description" class="text-muted-foreground text-xs">{{ option.description }}</span>
            </span>
            <SelectItemIndicator class="absolute top-2.5 right-2.5">
              <Check class="size-4" />
            </SelectItemIndicator>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
