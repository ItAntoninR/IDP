<script setup lang="ts">
import { KeyRound } from "lucide-vue-next";

defineProps<{ provider: string }>();
</script>

<template>
  <Teleport to="body">
    <div
      class="bg-background/85 animate-in fade-in-0 fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 backdrop-blur-sm duration-200"
      role="status"
      aria-live="polite"
    >
      <div class="relative flex size-16 items-center justify-center">
        <span class="border-foreground/10 border-t-foreground absolute inset-0 animate-spin rounded-full border-2" />
        <span class="bg-background flex size-10 items-center justify-center rounded-xl border shadow-sm [&_svg]:size-5">
          <slot name="icon"><KeyRound /></slot>
        </span>
      </div>
      <div class="space-y-1 text-center">
        <p class="font-medium">Redirection vers {{ provider }}…</p>
        <p class="text-muted-foreground text-sm">Vous allez revenir ici une fois connecté.</p>
      </div>
    </div>
  </Teleport>
</template>
