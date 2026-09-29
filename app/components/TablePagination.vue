<script setup lang="ts">
import { ChevronLeft, ChevronRight } from "lucide-vue-next";

const page = defineModel<number>({ required: true });
const props = defineProps<{ total: number; pageSize: number }>();

const pages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)));
const from = computed(() => (props.total ? page.value * props.pageSize + 1 : 0));
const to = computed(() => Math.min(props.total, (page.value + 1) * props.pageSize));
</script>

<template>
  <div class="text-muted-foreground flex items-center justify-between gap-3 border-t px-4 py-2.5 text-xs">
    <span class="tabular-nums">{{ from }}–{{ to }} sur {{ total }}</span>
    <div v-if="pages > 1" class="flex items-center gap-1">
      <span class="mr-2 tabular-nums">Page {{ page + 1 }} sur {{ pages }}</span>
      <Button variant="outline" size="icon" class="size-7" aria-label="Page précédente" :disabled="page === 0" @click="page--">
        <ChevronLeft />
      </Button>
      <Button variant="outline" size="icon" class="size-7" aria-label="Page suivante" :disabled="page + 1 >= pages" @click="page++">
        <ChevronRight />
      </Button>
    </div>
  </div>
</template>
