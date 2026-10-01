<script setup lang="ts">
import { ShieldAlert, ShieldCheck } from "lucide-vue-next";

const props = defineProps<{
  required: boolean;
  stats: { members: number; twoFactorEnabled: number } | null;
  canManage: boolean;
}>();

const coverage = computed(() =>
  props.stats && props.stats.members ? Math.round((props.stats.twoFactorEnabled / props.stats.members) * 100) : 0,
);
const missing = computed(() => (props.stats ? props.stats.members - props.stats.twoFactorEnabled : 0));
</script>

<template>
  <div class="bg-card flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 shadow-sm">
    <span
      class="flex size-9 shrink-0 items-center justify-center rounded-lg"
      :class="required && missing ? 'bg-amber-50 text-amber-700' : 'bg-muted'"
    >
      <component
        :is="required && !missing ? ShieldCheck : ShieldAlert"
        class="size-4"
      />
    </span>

    <div class="min-w-48 flex-1">
      <p class="text-sm font-medium">Double authentification {{ required ? "obligatoire" : "facultative" }}</p>

      <p class="text-muted-foreground text-xs">
        <template v-if="stats">
          {{ stats.twoFactorEnabled }} sur {{ stats.members }} membre{{ stats.members > 1 ? "s" : "" }} protégé{{
            stats.members > 1 ? "s" : ""
          }}
        </template>

        <template v-if="required && missing">· les autres devront l'activer à leur prochaine connexion</template>
      </p>
    </div>

    <div
      v-if="stats"
      class="bg-muted h-1.5 w-24 overflow-hidden rounded-full"
      :title="`${coverage} %`"
    >
      <div
        class="h-full rounded-full bg-emerald-500 transition-all"
        :style="{ width: `${coverage}%` }"
      />
    </div>

    <Button
      v-if="canManage"
      variant="outline"
      size="sm"
      as-child
    >
      <NuxtLink to="/org/settings">{{ required ? "Gérer" : "Exiger" }}</NuxtLink>
    </Button>
  </div>
</template>
