<script setup lang="ts">
import "vue-sonner/style.css";
</script>

<template>
  <div>
    <NuxtLoadingIndicator
      color="currentColor"
      :height="2"
      class="text-foreground"
    />

    <ImpersonationBanner />

    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>

    <Toaster
      rich-colors
      position="top-right"
    />
  </div>
</template>
