<script setup lang="ts">
import type { DialogCloseProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { reactiveOmit } from "@vueuse/core";
import { DialogClose, useForwardProps } from "reka-ui";
import { cn } from "@/lib/utils";

const props = defineProps<DialogCloseProps & { class?: HTMLAttributes["class"] }>();
const delegatedProps = reactiveOmit(props, "class");
const forwarded = useForwardProps(delegatedProps);
</script>

<template>
  <DialogClose
    data-slot="dialog-close"
    v-bind="forwarded"
    :class="cn('', props.class)"
  >
    <slot />
  </DialogClose>
</template>
