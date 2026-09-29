<template>
  <div class="space-y-6" aria-busy="true" aria-label="Chargement du tableau de bord">
    <div class="bg-brand-deep space-y-3 rounded-xl px-6 py-7 sm:px-8">
      <div class="h-5 w-24 animate-pulse rounded-full bg-white/10" />
      <div class="h-7 w-56 animate-pulse rounded-md bg-white/15" />
      <div class="h-4 w-72 max-w-full animate-pulse rounded-md bg-white/10" />
    </div>
    <div class="grid gap-4 lg:grid-cols-3">
      <div class="bg-card space-y-4 rounded-xl border p-6 shadow-sm lg:col-span-2">
        <Skeleton class="h-5 w-40" />
        <Skeleton class="h-4 w-64 max-w-full" />
        <div class="grid gap-3 sm:grid-cols-2">
          <Skeleton class="h-[74px] rounded-xl" />
          <Skeleton class="h-[74px] rounded-xl" />
        </div>
      </div>
      <div class="bg-card space-y-4 rounded-xl border p-6 shadow-sm">
        <Skeleton class="h-5 w-32" />
        <Skeleton class="h-4 w-48" />
        <Skeleton class="h-10 w-full" />
      </div>
    </div>
  </div>
</template>
