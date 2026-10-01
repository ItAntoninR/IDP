<script setup lang="ts">
const open = defineModel<boolean>("open", { required: true });

withDefaults(
  defineProps<{
    title: string;
    description?: string;
    confirmLabel?: string;
    destructive?: boolean;
    loading?: boolean;
  }>(),
  { confirmLabel: "Confirmer" },
);
const emit = defineEmits<{ confirm: [] }>();
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>

        <DialogDescription v-if="description">{{ description }}</DialogDescription>
      </DialogHeader>

      <slot />

      <DialogFooter>
        <Button
          variant="outline"
          @click="open = false"
        >
          Annuler
        </Button>

        <Button
          :variant="destructive ? 'destructive' : 'default'"
          :disabled="loading"
          @click="emit('confirm')"
        >
          {{ confirmLabel }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
