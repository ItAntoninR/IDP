<script setup lang="ts">
const model = defineModel<string>({ default: "" });

withDefaults(
  defineProps<{
    label: string;
    type?: string;
    hint?: string;
    required?: boolean;
    disabled?: boolean;
    readonly?: boolean;
    autocomplete?: string;
    minlength?: number;
    pattern?: string;
    placeholder?: string;
  }>(),
  { type: "text" },
);

const id = useId();
</script>

<template>
  <div class="grid gap-2">
    <Label :for="id">{{ label }}</Label>
    <Input
      :id="id"
      v-model="model"
      :type="type"
      :required="required"
      :disabled="disabled"
      :readonly="readonly"
      :autocomplete="autocomplete"
      :minlength="minlength"
      :pattern="pattern"
      :placeholder="placeholder"
    />
    <p v-if="hint" class="text-muted-foreground text-xs">{{ hint }}</p>
  </div>
</template>
