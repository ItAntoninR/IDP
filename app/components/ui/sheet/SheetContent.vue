<script setup lang="ts">
import type { DialogContentEmits, DialogContentProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { reactiveOmit } from "@vueuse/core";
import { X } from "lucide-vue-next";
import { DialogClose, DialogContent, DialogOverlay, DialogPortal, useForwardPropsEmits } from "reka-ui";
import { cn } from "@/lib/utils";

const props = defineProps<DialogContentProps & { class?: HTMLAttributes["class"] }>();
const emits = defineEmits<DialogContentEmits>();
const delegatedProps = reactiveOmit(props, "class");
const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <DialogPortal>
    <DialogOverlay
      class="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/40"
    />

    <DialogContent
      data-slot="sheet-content"
      v-bind="forwarded"
      :class="
        cn(
          'bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right fixed inset-y-0 right-0 z-50 flex h-full w-full flex-col overflow-y-auto border-l shadow-xl duration-300 sm:max-w-xl',
          props.class,
        )
      "
    >
      <slot />

      <DialogClose
        class="text-muted-foreground hover:text-foreground hover:bg-accent absolute top-4 right-4 cursor-pointer rounded-md p-1 transition-colors"
        aria-label="Fermer"
      >
        <X class="size-4" />
      </DialogClose>
    </DialogContent>
  </DialogPortal>
</template>
