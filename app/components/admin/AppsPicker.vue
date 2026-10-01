<script setup lang="ts">
import { APP_IDS } from "#shared/permissions";
import { RESOURCE_LABELS } from "~/lib/labels";

const model = defineModel<string[]>({ required: true });

function toggle(app: string, checked: boolean | "indeterminate") {
  model.value = checked === true ? [...new Set([...model.value, app])] : model.value.filter((a) => a !== app);
}
</script>

<template>
  <div class="flex flex-wrap gap-4">
    <Label
      v-for="app in APP_IDS"
      :key="app"
      class="cursor-pointer font-normal"
    >
      <Checkbox
        :aria-label="RESOURCE_LABELS[app] ?? app"
        :model-value="model.includes(app)"
        @update:model-value="(v) => toggle(app, v)"
      />
      {{ RESOURCE_LABELS[app] ?? app }}
    </Label>
  </div>
</template>
