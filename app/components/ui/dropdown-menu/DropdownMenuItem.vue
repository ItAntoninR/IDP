<script setup lang="ts">
import type { DropdownMenuItemEmits, DropdownMenuItemProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { reactiveOmit } from "@vueuse/core";
import { DropdownMenuItem, useForwardPropsEmits } from "reka-ui";
import { cn } from "@/lib/utils";

const props = defineProps<
  DropdownMenuItemProps & { class?: HTMLAttributes["class"]; variant?: "default" | "destructive" }
>();
const emits = defineEmits<DropdownMenuItemEmits>();
const delegatedProps = reactiveOmit(props, "class", "variant");
const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <DropdownMenuItem
    data-slot="dropdown-menu-item"
    v-bind="forwarded"
    :class="
      cn(
        'focus:bg-accent relative flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
        props.variant === 'destructive'
          ? 'text-destructive focus:bg-destructive/10 [&_svg]:text-destructive'
          : '[&_svg]:text-muted-foreground',
        props.class,
      )
    "
  >
    <slot />
  </DropdownMenuItem>
</template>
