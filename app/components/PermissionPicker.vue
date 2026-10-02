<script setup lang="ts">
import { APP_PERMISSIONS, MANDATORY_ACTION, ORG_PERMISSIONS } from "#shared/permissions";
import { actionLabel, RESOURCE_LABELS } from "~/lib/labels";
import { appActionGroups } from "~/lib/permission-groups";
import type { PermissionState } from "~/lib/types";

const ORGANIZATION_TAB = "organization";

const model = defineModel<PermissionState>({ required: true });
const props = defineProps<{ allowedApps: string[] }>();

const organizationGroups = Object.entries(ORG_PERMISSIONS);

const allowedAppPermissions = computed(() =>
  Object.entries(APP_PERMISSIONS).filter(([app]) => props.allowedApps.includes(app)),
);

const resourceLabel = (resource: string) => RESOURCE_LABELS[resource] ?? resource;

const isApp = (resource: string) => resource in APP_PERMISSIONS;

const isGranted = (resource: string, action: string) => model.value[resource]?.includes(action) ?? false;

const grantedCount = (resources: string[]) =>
  resources.reduce((total, resource) => total + (model.value[resource]?.length ?? 0), 0);

const organizationCount = computed(() => grantedCount(organizationGroups.map(([resource]) => resource)));

const tabLabel = (label: string, count: number) => (count ? `${label} · ${count}` : label);

function grant(current: Set<string>, resource: string, action: string) {
  current.add(action);
  if (isApp(resource)) current.add(MANDATORY_ACTION);
}

function revoke(current: Set<string>, resource: string, action: string) {
  if (isApp(resource) && action === MANDATORY_ACTION) current.clear();
  else current.delete(action);
}

function toggle(resource: string, action: string, checked: boolean | "indeterminate") {
  const current = new Set(model.value[resource] ?? []);

  if (checked === true) grant(current, resource, action);
  else revoke(current, resource, action);

  const next = { ...model.value, [resource]: [...current] };

  if (!next[resource]!.length) delete next[resource];
  model.value = next;
}
</script>

<template>
  <Tabs :default-value="ORGANIZATION_TAB">
    <TabsList class="w-full">
      <TabsTrigger :value="ORGANIZATION_TAB">{{ tabLabel("Organisation", organizationCount) }}</TabsTrigger>

      <TabsTrigger
        v-for="[app] in allowedAppPermissions"
        :key="app"
        :value="app"
      >
        {{ tabLabel(resourceLabel(app), grantedCount([app])) }}
      </TabsTrigger>
    </TabsList>

    <TabsContent :value="ORGANIZATION_TAB">
      <div class="grid gap-4 sm:grid-cols-2">
        <fieldset
          v-for="[resource, actions] in organizationGroups"
          :key="resource"
          class="rounded-lg border bg-white p-3"
        >
          <legend class="px-1 text-sm font-medium">{{ resourceLabel(resource) }}</legend>

          <div class="space-y-2">
            <Label
              v-for="action in actions"
              :key="action"
              class="cursor-pointer font-normal"
            >
              <Checkbox
                :aria-label="`${resourceLabel(resource)} : ${actionLabel(resource, action)}`"
                :model-value="isGranted(resource, action)"
                @update:model-value="(v) => toggle(resource, action, v)"
              />
              {{ actionLabel(resource, action) }}
            </Label>
          </div>
        </fieldset>
      </div>
    </TabsContent>

    <TabsContent
      v-for="[app, actions] in allowedAppPermissions"
      :key="app"
      :value="app"
      class="space-y-4"
    >
      <section class="rounded-lg border bg-white p-3">
        <Label class="cursor-pointer font-medium">
          <Checkbox
            :aria-label="actionLabel(app, MANDATORY_ACTION)"
            :model-value="isGranted(app, MANDATORY_ACTION)"
            @update:model-value="(v) => toggle(app, MANDATORY_ACTION, v)"
          />
          {{ actionLabel(app, MANDATORY_ACTION) }}
        </Label>

        <p class="text-muted-foreground mt-1 pl-6 text-sm">
          Sans cet accès, ce rôle n'a aucun droit sur {{ resourceLabel(app) }}. Cocher une autre permission l'accorde
          automatiquement.
        </p>
      </section>

      <div class="grid gap-4 sm:grid-cols-2">
        <fieldset
          v-for="group in appActionGroups(app, actions)"
          :key="group.label"
          class="rounded-lg border bg-white p-3"
        >
          <legend class="px-1 text-sm font-medium">{{ group.label }}</legend>

          <div class="space-y-2">
            <Label
              v-for="option in group.options"
              :key="option.action"
              class="cursor-pointer font-normal"
            >
              <Checkbox
                :aria-label="`${resourceLabel(app)} : ${actionLabel(app, option.action)}`"
                :model-value="isGranted(app, option.action)"
                @update:model-value="(v) => toggle(app, option.action, v)"
              />
              {{ option.label }}
            </Label>
          </div>
        </fieldset>
      </div>
    </TabsContent>

    <p
      v-if="!allowedAppPermissions.length"
      class="text-muted-foreground mt-3 text-sm"
    >
      Aucune application n'est autorisée pour cette organisation.
    </p>
  </Tabs>
</template>
