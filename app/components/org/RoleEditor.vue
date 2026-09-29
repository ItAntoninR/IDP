<script setup lang="ts">
import type { DynamicRole } from "~/lib/org";
import type { PermissionState } from "~/lib/types";

const props = defineProps<{
  initial?: DynamicRole;
  allowedApps: string[];
  save: (name: string, permission: PermissionState) => Promise<boolean>;
}>();
const emit = defineEmits<{ close: [] }>();

const name = ref(props.initial?.role ?? "");
const permission = ref<PermissionState>({ ...(props.initial?.permission ?? {}) });
const loading = ref(false);

async function submit() {
  loading.value = true;
  const saved = await props.save(name.value.trim().toLowerCase(), permission.value);
  loading.value = false;
  if (saved) emit("close");
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="submit">
    <FormField
      v-model="name"
      label="Nom du rôle"
      required
      pattern="[a-z0-9-]+"
      hint="Lettres minuscules, chiffres et tirets."
    />
    <PermissionPicker v-model="permission" :allowed-apps="allowedApps" />
    <div class="flex justify-end gap-2 border-t pt-4">
      <Button type="button" variant="outline" @click="emit('close')">Annuler</Button>
      <Button type="submit" :disabled="loading">{{ initial ? "Enregistrer" : "Créer le rôle" }}</Button>
    </div>
  </form>
</template>
