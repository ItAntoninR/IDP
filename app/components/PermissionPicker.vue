<script setup lang="ts">
import { APP_PERMISSIONS, ORG_PERMISSIONS } from "#shared/permissions";
import { actionLabel, RESOURCE_LABELS } from "~/lib/labels";
import type { PermissionState } from "~/lib/types";


const model = defineModel<PermissionState>({ required: true });
const props = defineProps<{ allowedApps: string[] }>();

const groups = computed(() => [
  ...Object.entries(ORG_PERMISSIONS),
  ...Object.entries(APP_PERMISSIONS).filter(([app]) => props.allowedApps.includes(app)),
]);

const isApp = (resource: string) => resource in APP_PERMISSIONS;

function toggle(resource: string, action: string, checked: boolean | "indeterminate") {
  const current = new Set(model.value[resource] ?? []);
  if (checked === true) {
    current.add(action);
    if (isApp(resource)) current.add("access");
  } else {
    current.delete(action);
    if (isApp(resource) && action === "access") current.clear();
  }
  const next = { ...model.value, [resource]: [...current] };
  if (!next[resource]!.length) delete next[resource];
  model.value = next;
}
</script>

<template>
  <div class="grid gap-4 sm:grid-cols-2">
    <fieldset v-for="[resource, actions] in groups" :key="resource" class="rounded-lg border bg-white p-3">
      <legend class="px-1 text-sm font-medium">{{ RESOURCE_LABELS[resource] ?? resource }}</legend>
      <div class="space-y-2">
        <Label v-for="action in actions" :key="action" class="cursor-pointer font-normal">
          <Checkbox
            :aria-label="`${RESOURCE_LABELS[resource] ?? resource} : ${actionLabel(resource, action)}`"
            :model-value="model[resource]?.includes(action) ?? false"
            @update:model-value="(v) => toggle(resource, action, v)"
          />
          {{ actionLabel(resource, action) }}
        </Label>
      </div>
    </fieldset>
    <p v-if="!allowedApps.length" class="text-muted-foreground text-sm sm:col-span-2">
      Aucune application n'est autorisée pour cette organisation.
    </p>
  </div>
</template>
