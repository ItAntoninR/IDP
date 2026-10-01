<script setup lang="ts">
import { Building2, KeyRound, ShieldCheck, Sparkles } from "lucide-vue-next";

const highlights = [
  { icon: Sparkles, title: "Un seul compte", text: "Le même identifiant pour toutes vos applications." },
  { icon: Building2, title: "Une organisation à la fois", text: "Les données de chaque client restent séparées." },
  { icon: ShieldCheck, title: "Accès maîtrisés", text: "Chaque gérant décide de ce que voit son équipe." },
];
</script>

<template>
  <div class="flex min-h-screen">
    <aside class="bg-brand-deep relative hidden w-[44%] max-w-2xl overflow-hidden text-white lg:flex lg:flex-col">
      <div class="auth-dots pointer-events-none absolute inset-0" />

      <div class="pointer-events-none absolute -right-40 -bottom-40 size-[36rem] rounded-full border border-white/10" />

      <div class="pointer-events-none absolute -right-20 -bottom-20 size-[26rem] rounded-full border border-white/10" />

      <div class="pointer-events-none absolute right-4 bottom-4 size-[16rem] rounded-full border border-white/10" />

      <div class="pointer-events-none absolute -top-32 -left-32 size-96 rounded-full bg-white/[0.04] blur-3xl" />

      <div class="relative flex flex-1 flex-col justify-between p-10 xl:p-14">
        <div class="flex items-center gap-2.5">
          <span class="flex size-9 items-center justify-center rounded-lg bg-white text-black shadow-sm">
            <KeyRound class="size-4" />
          </span>

          <span class="text-lg font-semibold">Auth</span>
        </div>

        <div class="max-w-md space-y-10">
          <div class="space-y-4">
            <h2 class="text-4xl leading-tight font-semibold tracking-tight">Toutes vos applications, un seul accès.</h2>

            <p class="text-base text-white/60">
              Connectez-vous une fois et retrouvez les outils que votre organisation vous ouvre.
            </p>
          </div>

          <ul class="space-y-5">
            <li
              v-for="item in highlights"
              :key="item.title"
              class="flex gap-4"
            >
              <span
                class="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5"
              >
                <component
                  :is="item.icon"
                  class="size-4"
                />
              </span>

              <span>
                <span class="block text-sm font-medium">{{ item.title }}</span>

                <span class="text-sm text-white/55">{{ item.text }}</span>
              </span>
            </li>
          </ul>
        </div>

        <p class="text-xs text-white/40">© Auth · Connexion sécurisée</p>
      </div>
    </aside>

    <main class="auth-dots-light relative flex flex-1 items-start justify-center px-4 py-12 sm:items-center sm:px-8">
      <div class="relative w-full max-w-sm space-y-8">
        <div class="flex items-center gap-2.5 lg:hidden">
          <span class="bg-brand text-brand-foreground flex size-9 items-center justify-center rounded-lg shadow-sm">
            <KeyRound class="size-4" />
          </span>

          <span class="text-lg font-semibold">Auth</span>
        </div>

        <slot />
      </div>
    </main>
  </div>
</template>

<style scoped>
.auth-dots {
  background-image: radial-gradient(rgb(255 255 255 / 0.09) 1px, transparent 1px);
  background-size: 22px 22px;
  mask-image: linear-gradient(to bottom, black 0%, transparent 75%);
}

.auth-dots-light {
  background-image: radial-gradient(rgb(0 0 0 / 0.045) 1px, transparent 1px);
  background-size: 22px 22px;
}
</style>
