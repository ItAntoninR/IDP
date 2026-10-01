<script setup lang="ts">
import { toast } from "vue-sonner";
import { errorMessage } from "~/lib/errors";

const emit = defineEmits<{ created: []; cancel: [] }>();

const name = ref("");
const slug = ref("");
const slugTouched = ref(false);
const apps = ref<string[]>([]);
const ownerEmail = ref("");
const loading = ref(false);

const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

watch(name, (value) => {
  if (!slugTouched.value) slug.value = slugify(value);
});

async function submit() {
  loading.value = true;
  try {
    await $fetch("/api/admin/organizations", {
      method: "POST",
      body: { name: name.value, slug: slug.value, apps: apps.value, ownerEmail: ownerEmail.value },
    });
    toast.success(`Organisation créée. Invitation envoyée à ${ownerEmail.value}.`);
    emit("created");
  } catch (e) {
    toast.error(errorMessage((e as { data?: unknown }).data ?? e));
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <form
    class="space-y-5"
    @submit.prevent="submit"
  >
    <div class="grid gap-4 sm:grid-cols-2">
      <FormField
        v-model="name"
        label="Nom"
        required
      />

      <FormField
        :model-value="slug"
        label="Slug"
        required
        pattern="[a-z0-9]+(-[a-z0-9]+)*"
        @update:model-value="(v) => ((slugTouched = true), (slug = v))"
      />
    </div>

    <FormField
      v-model="ownerEmail"
      label="Email du gérant"
      type="email"
      required
      hint="Il recevra une invitation pour gérer l'organisation."
    />

    <div class="grid gap-2">
      <Label>Applications autorisées</Label>

      <AdminAppsPicker
        v-model="apps"
        class="pt-1"
      />
    </div>

    <DialogFooter>
      <Button
        type="button"
        variant="outline"
        @click="emit('cancel')"
      >
        Annuler
      </Button>

      <Button
        type="submit"
        :disabled="loading"
      >
        Créer et inviter
      </Button>
    </DialogFooter>
  </form>
</template>
