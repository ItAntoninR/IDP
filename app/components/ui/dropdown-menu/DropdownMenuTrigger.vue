<script setup lang="ts">
import type { DropdownMenuTriggerProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { reactiveOmit } from "@vueuse/core";
import { DropdownMenuTrigger, useForwardProps } from "reka-ui";
import { cn } from "@/lib/utils";

const props = defineProps<DropdownMenuTriggerProps & { class?: HTMLAttributes["class"] }>();
const delegatedProps = reactiveOmit(props, "class");
const forwarded = useForwardProps(delegatedProps);
</script>

<template>
  <DropdownMenuTrigger
    data-slot="dropdown-menu-trigger"
    v-bind="forwarded"
    :class="cn('', props.class)"
  >
    <slot />
  </DropdownMenuTrigger>
</template>
