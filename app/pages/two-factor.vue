<script setup lang="ts">
import { LoaderCircle, ShieldCheck } from "lucide-vue-next";
import { authClient } from "~/lib/auth-client";
import { errorMessage } from "~/lib/errors";
import { goTo, isOAuthFlow, resumeAuthorizeUrl, safeRedirect } from "~/lib/oauth";

definePageMeta({ layout: "auth" });
useHead({ title: "Double authentification" });

const route = useRoute();
const mode = ref<"totp" | "backup">("totp");
const code = ref("");
const trustDevice = ref(false);
const loading = ref(false);
const error = ref("");

const target = () => (isOAuthFlow() ? resumeAuthorizeUrl() : safeRedirect(route.query.callbackURL, "/"));

function switchMode() {
  mode.value = mode.value === "totp" ? "backup" : "totp";
  code.value = "";
  error.value = "";
}

async function submit() {
  error.value = "";
  loading.value = true;
  const body = { code: code.value.replace(/\s/g, ""), trustDevice: trustDevice.value };
  const res = mode.value === "totp" ? await authClient.twoFactor.verifyTotp(body) : await authClient.twoFactor.verifyBackupCode(body);
  if (res.error) {
    loading.value = false;
    code.value = "";
    return (error.value = errorMessage(res.error));
  }
  await goTo(target());
}
</script>

<template>
  <AuthCard
    title="Double authentification"
    :description="
      mode === 'totp'
        ? 'Saisissez le code à 6 chiffres affiché dans votre application d\'authentification.'
        : 'Saisissez l\'un de vos codes de secours. Chaque code ne sert qu\'une fois.'
    "
  >
    <FormAlert :message="error" />
    <form class="space-y-5" @submit.prevent="submit">
      <div class="grid gap-2">
        <Label for="code">{{ mode === "totp" ? "Code" : "Code de secours" }}</Label>
        <Input
          id="code"
          v-model="code"
          :inputmode="mode === 'totp' ? 'numeric' : 'text'"
          autocomplete="one-time-code"
          :maxlength="mode === 'totp' ? 6 : 32"
          :placeholder="mode === 'totp' ? '123456' : 'xxxxx-xxxxx'"
          class="h-12 text-center font-mono text-lg tracking-[0.4em]"
          autofocus
          required
        />
      </div>
      <Label class="cursor-pointer font-normal">
        <Checkbox v-model="trustDevice" />
        Faire confiance à cet appareil pendant 30 jours
      </Label>
      <Button type="submit" class="w-full" :disabled="loading || !code">
        <LoaderCircle v-if="loading" class="animate-spin" />
        <ShieldCheck v-else />
        {{ loading ? "Vérification…" : "Vérifier" }}
      </Button>
    </form>
    <div class="flex justify-between text-sm">
      <button type="button" class="text-muted-foreground cursor-pointer hover:underline" @click="switchMode">
        {{ mode === "totp" ? "Utiliser un code de secours" : "Utiliser l'application" }}
      </button>
      <NuxtLink to="/sign-in" class="text-muted-foreground hover:underline">Retour</NuxtLink>
    </div>
  </AuthCard>
</template>
