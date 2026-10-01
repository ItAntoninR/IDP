<script setup lang="ts">
import { useEventListener } from "@vueuse/core";
import { Fingerprint, LoaderCircle } from "lucide-vue-next";
import { authClient } from "~/lib/auth-client";
import { errorMessage, urlErrorMessage } from "~/lib/errors";
import { getPublicConfig } from "~/lib/api";
import { goTo, isOAuthFlow, resumeAuthorizeUrl, safeRedirect } from "~/lib/oauth";

definePageMeta({ layout: "auth" });
useHead({ title: "Connexion" });

const route = useRoute();
const session = authClient.useSession();

const redirectTarget = () => (isOAuthFlow() ? resumeAuthorizeUrl() : safeRedirect(route.query.callbackURL, "/"));

function returnURL() {
  const params = new URLSearchParams(window.location.search);

  params.delete("error");
  params.delete("error_description");
  params.delete("provider");
  const query = params.toString();

  return `/sign-in${query ? `?${query}` : ""}`;
}

type Step = "email" | "password" | "magic";
const mode = ref<Step>("email");
const email = ref(typeof route.query.email === "string" ? route.query.email : "");
const password = ref("");
const error = ref(urlErrorMessage(route.query.error));
const sent = ref(false);
const loading = ref(false);

type Provider = "google" | "microsoft" | "authentik";
const requestedProvider = (["authentik", "microsoft", "google"] as const).find(
  (p) => p === route.query.provider && !route.query.error,
);
const redirecting = ref<Provider | null>(requestedProvider ?? null);
const passkeyLoading = ref(false);
const passkeySupported = ref(false);
const lastMethod = ref<string | null>(null);

const featured = computed<"passkey" | "google" | "microsoft" | "authentik" | null>(() => {
  const m = lastMethod.value;

  if (m === "passkey" && passkeySupported.value) return "passkey";
  if (m === "google" && googleEnabled.value) return "google";
  if (m === "microsoft" && microsoftEnabled.value) return "microsoft";
  if (m === "authentik" && authentikEnabled.value) return "authentik";

  return null;
});

async function startRequestedProvider() {
  const requested = requestedProvider;

  if (!requested) return;
  const signedIn = !!(await authClient.getSession()).data;
  const config = await getPublicConfig().catch(() => null);
  const enabled = {
    authentik: config?.authentikEnabled,
    microsoft: config?.microsoftEnabled,
    google: config?.googleEnabled,
  };

  if (signedIn) {
    redirecting.value = null;

    return;
  }

  if (enabled[requested]) await signInWith(requested);
  else redirecting.value = null;
}

function continueWithFeatured() {
  if (featured.value === "passkey") return signInWithPasskey();
  if (featured.value) return signInWith(featured.value);
}

const PROVIDER_LABELS = { google: "Google", microsoft: "Microsoft", authentik: "Authentik" } as const;
const googleEnabled = ref(false);
const microsoftEnabled = ref(false);
const authentikEnabled = ref(false);

async function afterPasskey(res: { error?: unknown } | undefined, silent = false) {
  if (!res?.error) return goTo(redirectTarget());
  const code = (res.error as { code?: string }).code;

  if (!silent && code !== "AUTH_CANCELLED") error.value = errorMessage(res.error);
}

async function signInWithPasskey() {
  error.value = "";
  passkeyLoading.value = true;
  const res = await authClient.signIn.passkey();

  passkeyLoading.value = false;
  await afterPasskey(res);
}

onMounted(async () => {
  passkeySupported.value = typeof window.PublicKeyCredential !== "undefined";
  lastMethod.value = authClient.getLastUsedLoginMethod();
  startRequestedProvider();
  if (await window.PublicKeyCredential?.isConditionalMediationAvailable?.().catch(() => false)) {
    authClient.signIn.passkey({ autoFill: true }).then((res) => afterPasskey(res, true));
  }
});

onMounted(() => {
  getPublicConfig()
    .then((c) => {
      googleEnabled.value = c.googleEnabled;
      microsoftEnabled.value = c.microsoftEnabled;
      authentikEnabled.value = c.authentikEnabled;
    })
    .catch(() => undefined);
});

watchEffect(() => {
  if (session.value.data && !session.value.isPending) goTo(redirectTarget());
});

function continueWithEmail() {
  error.value = "";
  mode.value = lastMethod.value === "magic-link" ? "magic" : "password";
}

function switchMode(m: Step) {
  mode.value = m;
  sent.value = false;
  error.value = "";
}

async function submitPassword() {
  error.value = "";
  loading.value = true;
  const res = await authClient.signIn.email({ email: email.value, password: password.value });

  loading.value = false;
  if (res.error) return (error.value = errorMessage(res.error));
  if ((res.data as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect) return;
  await goTo(redirectTarget());
}

async function submitMagicLink() {
  error.value = "";
  loading.value = true;
  const res = await authClient.signIn.magicLink({
    email: email.value,
    callbackURL: redirectTarget(),
    errorCallbackURL: returnURL(),
  });

  loading.value = false;
  if (res.error) return (error.value = errorMessage(res.error));
  sent.value = true;
}

async function signInWith(provider: Provider) {
  error.value = "";
  redirecting.value = provider;
  const res = await authClient.signIn.social({
    provider,
    callbackURL: redirectTarget(),
    errorCallbackURL: returnURL(),
  });

  if (res.error) {
    redirecting.value = null;
    error.value = errorMessage(res.error);
  }
}

useEventListener("pageshow", () => (redirecting.value = null));
</script>

<template>
  <div class="space-y-8">
    <PageLoader v-if="session.isPending || session.data" />

    <AuthCard
      v-else
      title="Connexion"
      description="Accédez à vos applications"
    >
      <FormAlert :message="error" />

      <div
        v-if="featured"
        class="space-y-2 border-b pb-5"
      >
        <Button
          class="h-11 w-full"
          :disabled="!!redirecting || passkeyLoading"
          @click="continueWithFeatured"
        >
          <LoaderCircle
            v-if="passkeyLoading"
            class="animate-spin"
          />

          <Fingerprint v-else-if="featured === 'passkey'" />

          <GoogleIcon v-else-if="featured === 'google'" />

          <MicrosoftIcon v-else-if="featured === 'microsoft'" />

          <AuthentikIcon v-else />
          Continuer avec {{ featured === "passkey" ? "une passkey" : PROVIDER_LABELS[featured] }}
        </Button>

        <p class="text-muted-foreground text-center text-xs">Dernière méthode utilisée sur cet appareil</p>
      </div>

      <form
        v-if="mode === 'email'"
        class="space-y-4"
        @submit.prevent="continueWithEmail"
      >
        <FormField
          v-model="email"
          label="Email"
          type="email"
          autocomplete="email webauthn"
          placeholder="nom@entreprise.fr"
          required
        />

        <Button
          type="submit"
          class="w-full"
          :variant="featured ? 'outline' : 'default'"
        >
          Continuer
        </Button>
      </form>

      <template v-else>
        <div class="bg-muted/60 flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
          <span class="truncate">{{ email }}</span>

          <button
            type="button"
            class="text-muted-foreground shrink-0 cursor-pointer text-xs hover:underline"
            @click="switchMode('email')"
          >
            Modifier
          </button>
        </div>

        <form
          v-if="mode === 'password'"
          class="space-y-4"
          @submit.prevent="submitPassword"
        >
          <input
            type="email"
            :value="email"
            autocomplete="username"
            class="hidden"
            aria-hidden="true"
            tabindex="-1"
          />

          <FormField
            v-model="password"
            label="Mot de passe"
            type="password"
            autocomplete="current-password"
            required
          />

          <Button
            type="submit"
            class="w-full"
            :disabled="loading"
          >
            <LoaderCircle
              v-if="loading"
              class="animate-spin"
            />
            {{ loading ? "Connexion…" : "Se connecter" }}
          </Button>

          <div class="text-muted-foreground flex flex-wrap justify-between gap-2 text-sm">
            <NuxtLink
              :to="{ path: '/forgot-password', query: { email } }"
              class="hover:underline"
            >
              Mot de passe oublié ?
            </NuxtLink>

            <button
              type="button"
              class="cursor-pointer hover:underline"
              @click="switchMode('magic')"
            >
              Recevoir un lien par email
            </button>
          </div>
        </form>

        <div
          v-else
          class="space-y-4"
        >
          <FormAlert
            v-if="sent"
            tone="success"
            :message="`Si un compte correspond à ${email}, un lien de connexion vient d'être envoyé. Il est valable 5 minutes.`"
          />

          <form
            v-else
            class="space-y-4"
            @submit.prevent="submitMagicLink"
          >
            <p class="text-muted-foreground text-sm">Nous vous envoyons un lien qui vous connecte sans mot de passe.</p>

            <Button
              type="submit"
              class="w-full"
              :disabled="loading"
            >
              <LoaderCircle
                v-if="loading"
                class="animate-spin"
              />
              Recevoir le lien
            </Button>
          </form>

          <button
            type="button"
            class="text-muted-foreground block w-full cursor-pointer text-center text-sm hover:underline"
            @click="switchMode('password')"
          >
            Utiliser mon mot de passe
          </button>
        </div>
      </template>

      <div class="space-y-3">
        <div class="text-muted-foreground flex items-center gap-3 text-xs">
          <Separator class="flex-1" />

          ou
          <Separator class="flex-1" />
        </div>

        <div class="grid grid-cols-2 gap-2">
          <Button
            v-if="passkeySupported && featured !== 'passkey'"
            variant="outline"
            :disabled="!!redirecting || passkeyLoading"
            @click="signInWithPasskey"
          >
            <LoaderCircle
              v-if="passkeyLoading"
              class="animate-spin"
            />

            <Fingerprint v-else />
            Passkey
          </Button>

          <Button
            v-if="featured !== 'microsoft'"
            variant="outline"
            :disabled="!!redirecting || !microsoftEnabled"
            :title="microsoftEnabled ? 'Continuer avec Microsoft' : 'Connexion Microsoft pas encore configurée'"
            @click="signInWith('microsoft')"
          >
            <MicrosoftIcon />
            Microsoft
          </Button>

          <Button
            v-if="featured !== 'google'"
            variant="outline"
            :disabled="!!redirecting || !googleEnabled"
            :title="googleEnabled ? 'Continuer avec Google' : 'Connexion Google pas encore configurée'"
            @click="signInWith('google')"
          >
            <GoogleIcon />
            Google
          </Button>

          <Button
            v-if="authentikEnabled && featured !== 'authentik'"
            variant="outline"
            :disabled="!!redirecting"
            title="Continuer avec Authentik"
            @click="signInWith('authentik')"
          >
            <AuthentikIcon />
            Authentik
          </Button>
        </div>
      </div>

      <p class="text-muted-foreground text-center text-xs">L'accès se fait uniquement sur invitation.</p>
    </AuthCard>

    <RedirectOverlay
      v-if="redirecting"
      :provider="PROVIDER_LABELS[redirecting]"
    >
      <template #icon>
        <GoogleIcon v-if="redirecting === 'google'" />

        <MicrosoftIcon v-else-if="redirecting === 'microsoft'" />

        <AuthentikIcon v-else />
      </template>
    </RedirectOverlay>
  </div>
</template>
