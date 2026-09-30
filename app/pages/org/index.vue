<script setup lang="ts">
import { UserPlus } from "lucide-vue-next";

definePageMeta({ middleware: "auth" });
useHead({ title: "Personnes" });

const route = useRoute();
const { org, rights, insights, appLabels, roleNames, error, load, refresh } = useManagedOrganization();
const inviteOpen = ref(route.query.invite === "1");
const people = ref<{ reload: () => void } | null>(null);

function onInvited() {
  people.value?.reload();
  refresh();
}

const summary = computed(() => `Applications autorisées : ${appLabels.value}`);

onMounted(load);
</script>

<template>
  <FormAlert v-if="error" :message="error" />
  <PageLoader v-else-if="!org || !rights" />
  <template v-else>
    <PageHeader :title="org.name" :description="summary">
      <template v-if="rights.invite" #actions>
        <Button @click="inviteOpen = true"><UserPlus /> Inviter un membre</Button>
      </template>
    </PageHeader>

    <OrgSecurityBanner :required="org.requireTwoFactor === true" :stats="insights?.stats ?? null" :can-manage="rights.settings" />

    <OrgPeopleTable ref="people" :org="org" :roles="roleNames" :rights="rights" @changed="refresh" @invite="inviteOpen = true" />

    <OrgInviteDialog
      v-if="rights.invite"
      v-model:open="inviteOpen"
      :organization-id="org.id"
      :organization-name="org.name"
      :roles="roleNames"
      @invited="onInvited"
    />
  </template>
</template>
