<script setup lang="ts">
import { normalizeRolePermissions, statement } from "#shared/permissions";
import { actionLabel, RESOURCE_LABELS } from "~/lib/labels";

const props = defineProps<{ permission: Record<string, string[]> }>();

const entries = computed(() =>
  Object.entries(normalizeRolePermissions(props.permission))
    .filter(([, actions]) => actions?.length)
    .map(([resource, actions]) => {
      const order = (statement as Record<string, readonly string[]>)[resource] ?? [];
      const sorted = [...(actions ?? [])].sort((a, b) => order.indexOf(a) - order.indexOf(b));

      return {
        resource,
        label: `${RESOURCE_LABELS[resource] ?? resource} : ${sorted.map((a) => actionLabel(resource, a)).join(", ")}`,
      };
    }),
);
</script>

<template>
  <div class="flex flex-wrap gap-1">
    <Badge
      v-for="e in entries"
      :key="e.resource"
      variant="secondary"
    >
      {{ e.label }}
    </Badge>

    <span
      v-if="!entries.length"
      class="text-muted-foreground text-sm"
    >
      Aucune permission
    </span>
  </div>
</template>
