<script setup lang="ts">
import { authClient } from "~/lib/auth-client";
import { errorMessage, urlErrorMessage } from "~/lib/errors";
import { getMyOrganizations, type AppLink } from "~/lib/api";
import { roleLabel } from "~/lib/labels";

definePageMeta({ layout: "auth" });
useHead({ title: "Invitation" });

interface InvitationDetails {
  organizationId: string;
  organizationName: string;
  inviterEmail?: string;
  role: string;
}

const route = useRoute();
const id = String(route.params.id);
const email = typeof route.query.email === "string" ? route.query.email : "";
const returnTo = `/invite/${encodeURIComponent(id)}?email=${encodeURIComponent(email)}`;

const session = authClient.useSession();
const invitation = ref<InvitationDetails | null>(null);
const error = ref(urlErrorMessage(route.query.error));
const loading = ref(false);
const joinedApps = ref<AppLink[] | null>(null);

const mode = ref<"choose" | "password" | "sent">("choose");
const name = ref("");
const password = ref("");

const wrongAccount = computed(
  () => !!session.value.data && !!email && session.value.data.user.email.toLowerCase() !== email.toLowerCase(),
);

watch(
  () => session.value.data?.user.id,
  async (userId) => {
    if (!userId || wrongAccount.value) return;
    const res = await authClient.organization.getInvitation({ query: { id } });

    if (res.error) error.value = errorMessage(res.error);
    else invitation.value = res.data as unknown as InvitationDetails;
  },
  { immediate: true },
);

async function sendMagicLink() {
  error.value = "";
  loading.value = true;
  const res = await authClient.signIn.magicLink({ email, callbackURL: returnTo, errorCallbackURL: returnTo });

  loading.value = false;
  if (res.error) return (error.value = errorMessage(res.error));
  mode.value = "sent";
}

async function signUp() {
  error.value = "";
  loading.value = true;
  const res = await authClient.signUp.email({
    email,
    password: password.value,
    name: name.value,
    callbackURL: returnTo,
  });

  loading.value = false;
  if (res.error) return (error.value = errorMessage(res.error));
  mode.value = "sent";
}

async function accept() {
  error.value = "";
  loading.value = true;
  const res = await authClient.organization.acceptInvitation({ invitationId: id });

  if (res.error) {
    loading.value = false;

    return (error.value = errorMessage(res.error));
  }

  const organizationId = res.data?.member.organizationId ?? invitation.value?.organizationId;

  if (organizationId) await authClient.organization.setActive({ organizationId });
  const apps = (await getMyOrganizations()).find((o) => o.id === organizationId)?.apps ?? [];

  if (apps.length === 1) {
    window.location.href = apps[0]!.url;

    return;
  }

  loading.value = false;
  joinedApps.value = apps;
}

async function reject() {
  loading.value = true;
  await authClient.organization.rejectInvitation({ invitationId: id });
  window.location.href = "/";
}

async function switchAccount() {
  await authClient.signOut();
  window.location.reload();
}
</script>

<template>
  <PageLoader v-if="session.isPending" />

  <AuthCard
    v-else
    title="Invitation"
    :description="
      invitation ? `Rejoindre ${invitation.organizationName}` : 'Vous avez été invité à rejoindre une organisation.'
    "
  >
    <FormAlert :message="error" />

    <template v-if="!session.data">
      <FormAlert
        v-if="mode === 'sent'"
        tone="success"
        :message="`Un email vient d'être envoyé à ${email}. Cliquez sur le lien qu'il contient pour revenir ici et accepter l'invitation.`"
      />

      <template v-else>
        <FormField
          :model-value="email"
          label="Email"
          type="email"
          disabled
        />

        <template v-if="mode === 'choose'">
          <Button
            class="w-full"
            :disabled="loading"
            @click="sendMagicLink"
          >
            Recevoir un lien de connexion
          </Button>

          <div class="text-muted-foreground flex items-center gap-3 text-xs">
            <Separator class="flex-1" />

            ou
            <Separator class="flex-1" />
          </div>

          <div class="grid gap-2 sm:grid-cols-2">
            <Button
              variant="outline"
              @click="mode = 'password'"
            >
              Créer un mot de passe
            </Button>

            <Button
              variant="outline"
              as-child
            >
              <NuxtLink :to="{ path: '/sign-in', query: { email, callbackURL: returnTo } }">
                J'ai déjà un compte
              </NuxtLink>
            </Button>
          </div>
        </template>

        <form
          v-else
          class="space-y-4"
          @submit.prevent="signUp"
        >
          <FormField
            v-model="name"
            label="Nom"
            autocomplete="name"
            required
          />

          <FormField
            v-model="password"
            label="Mot de passe"
            type="password"
            autocomplete="new-password"
            :minlength="10"
            required
            hint="10 caractères minimum."
          />

          <Button
            type="submit"
            class="w-full"
            :disabled="loading"
          >
            Créer mon compte
          </Button>

          <Button
            type="button"
            variant="ghost"
            class="w-full"
            @click="mode = 'choose'"
          >
            Retour
          </Button>
        </form>
      </template>
    </template>

    <template v-else-if="wrongAccount">
      <FormAlert
        :message="`Cette invitation a été envoyée à ${email}, mais vous êtes connecté avec ${session.data.user.email}.`"
      />

      <Button
        variant="outline"
        class="w-full"
        @click="switchAccount"
      >
        Changer de compte
      </Button>
    </template>

    <template v-else-if="joinedApps">
      <FormAlert
        tone="success"
        message="Bienvenue ! Vous faites maintenant partie de l'organisation."
      />

      <div
        v-if="joinedApps.length"
        class="grid gap-2"
      >
        <Button
          v-for="app in joinedApps"
          :key="app.id"
          as-child
          class="w-full"
        >
          <a :href="app.url">Ouvrir {{ app.label }}</a>
        </Button>
      </div>

      <Button
        v-else
        as-child
        class="w-full"
      >
        <NuxtLink to="/">Accéder à mon espace</NuxtLink>
      </Button>
    </template>

    <template v-else-if="invitation">
      <p class="text-muted-foreground text-sm">
        {{ invitation.inviterEmail ? `${invitation.inviterEmail} vous invite` : "Vous êtes invité" }} à rejoindre
        <strong class="text-foreground">{{ invitation.organizationName }}</strong>
        en tant que
        <strong class="text-foreground">{{ roleLabel(invitation.role) }}</strong>
        .
      </p>

      <div class="grid gap-2 sm:grid-cols-2">
        <Button
          :disabled="loading"
          @click="accept"
        >
          Accepter
        </Button>

        <Button
          variant="outline"
          :disabled="loading"
          @click="reject"
        >
          Refuser
        </Button>
      </div>
    </template>

    <PageLoader v-else-if="!error" />
  </AuthCard>
</template>
