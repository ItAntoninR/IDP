<script setup lang="ts">
import { renderSVG } from "uqr";
import { Copy, Download } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { authClient } from "~/lib/auth-client";
import { errorMessage } from "~/lib/errors";

const props = defineProps<{ hasPassword: boolean }>();
const emit = defineEmits<{ done: [] }>();

const step = ref<"password" | "scan" | "codes">(props.hasPassword ? "password" : "scan");
const password = ref("");
const code = ref("");
const totpURI = ref("");
const backupCodes = ref<string[]>([]);
const loading = ref(false);
const error = ref("");

const qr = computed(() => (totpURI.value ? renderSVG(totpURI.value, { border: 1 }) : ""));
const secret = computed(() => (totpURI.value ? (new URL(totpURI.value).searchParams.get("secret") ?? "") : ""));

async function start() {
  error.value = "";
  loading.value = true;
  const res = await authClient.twoFactor.enable(props.hasPassword ? { password: password.value } : {});

  loading.value = false;
  if (res.error) return (error.value = errorMessage(res.error));
  if (res.data.method !== "totp") return (error.value = "Méthode de double authentification inattendue.");
  totpURI.value = res.data.totpURI;
  backupCodes.value = res.data.backupCodes;
  step.value = "scan";
}

async function confirm() {
  error.value = "";
  loading.value = true;
  const res = await authClient.twoFactor.verifyTotp({ code: code.value.replace(/\s/g, "") });

  loading.value = false;
  if (res.error) {
    code.value = "";

    return (error.value = errorMessage(res.error));
  }

  step.value = "codes";
}

async function copyCodes() {
  await navigator.clipboard.writeText(backupCodes.value.join("\n"));
  toast.success("Codes copiés.");
}

function downloadCodes() {
  const blob = new Blob([`Codes de secours Auth\n\n${backupCodes.value.join("\n")}\n`], { type: "text/plain" });
  const link = document.createElement("a");

  link.href = URL.createObjectURL(blob);
  link.download = "codes-de-secours.txt";
  link.click();
  URL.revokeObjectURL(link.href);
}

onMounted(() => {
  if (step.value === "scan") start();
});
</script>

<template>
  <div class="space-y-5">
    <FormAlert :message="error" />

    <form
      v-if="step === 'password'"
      class="space-y-4"
      @submit.prevent="start"
    >
      <FormField
        v-model="password"
        label="Confirmez votre mot de passe"
        type="password"
        autocomplete="current-password"
        required
      />

      <Button
        type="submit"
        :disabled="loading"
      >
        Continuer
      </Button>
    </form>

    <template v-else-if="step === 'scan'">
      <PageLoader v-if="!totpURI" />

      <template v-else>
        <ol class="text-muted-foreground list-decimal space-y-1 pl-5 text-sm">
          <li>
            Ouvrez votre application d'authentification (Google Authenticator, Microsoft Authenticator, 1Password…).
          </li>

          <li>Scannez ce QR code, ou saisissez la clé manuellement.</li>

          <li>Entrez le code à 6 chiffres affiché pour confirmer.</li>
        </ol>

        <div class="flex flex-wrap items-center gap-5">
          <!-- QR code SVG généré localement par uqr à partir de l'URI TOTP : pas de contenu externe. -->
          <!-- eslint-disable vue/no-v-html -->
          <div
            class="size-40 shrink-0 rounded-xl border bg-white p-2 [&_svg]:size-full"
            v-html="qr"
          />
          <!-- eslint-enable vue/no-v-html -->

          <div class="min-w-0 flex-1 space-y-2">
            <p class="text-muted-foreground text-xs">Clé manuelle</p>

            <code class="bg-muted block rounded-md px-2 py-1.5 font-mono text-xs break-all">{{ secret }}</code>
          </div>
        </div>

        <form
          class="flex items-end gap-2"
          @submit.prevent="confirm"
        >
          <div class="grid flex-1 gap-2">
            <Label for="totp-code">Code de vérification</Label>

            <Input
              id="totp-code"
              v-model="code"
              inputmode="numeric"
              autocomplete="one-time-code"
              maxlength="6"
              placeholder="123456"
              class="font-mono tracking-widest"
              required
            />
          </div>

          <Button
            type="submit"
            :disabled="loading || code.length < 6"
          >
            Activer
          </Button>
        </form>
      </template>
    </template>

    <template v-else>
      <FormAlert
        tone="success"
        message="La double authentification est activée."
      />

      <div class="space-y-2">
        <p class="text-sm font-medium">Vos codes de secours</p>

        <p class="text-muted-foreground text-sm">
          Gardez-les en lieu sûr. Chacun permet de vous connecter une fois si vous perdez votre téléphone. Ils ne seront
          plus affichés.
        </p>

        <div class="bg-muted grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg p-4 font-mono text-sm">
          <span
            v-for="c in backupCodes"
            :key="c"
          >
            {{ c }}
          </span>
        </div>

        <div class="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            @click="copyCodes"
          >
            <Copy />
            Copier
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            @click="downloadCodes"
          >
            <Download />
            Télécharger
          </Button>
        </div>
      </div>

      <Button
        type="button"
        @click="emit('done')"
      >
        J'ai sauvegardé mes codes
      </Button>
    </template>
  </div>
</template>
