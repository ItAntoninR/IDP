import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: "2026-09-01",
  ssr: false,
  spaLoadingTemplate: true,
  devtools: { enabled: false },
  modules: ["shadcn-nuxt"],
  shadcn: {
    prefix: "",
    componentDir: "./app/components/ui",
  },
  css: ["~/assets/css/main.css"],
  vite: {
    plugins: [tailwindcss()],
  },
  app: {
    head: {
      htmlAttrs: { lang: "fr" },
      title: "Connexion",
      meta: [{ name: "robots", content: "noindex" }],
    },
  },
  nitro: {
    preset: "node-server",
    errorHandler: "~~/server/error",
  },
  typescript: {
    strict: true,
  },
});
