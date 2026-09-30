<script setup lang="ts">
import { authClient } from "~/lib/auth-client";

definePageMeta({ middleware: "auth" });
useHead({ title: "Profil" });

const session = authClient.useSession();
const { accounts, load } = useLinkedAccounts();
</script>

<template>
  <PageLoader v-if="!session.data || !accounts" />
  <template v-else>
    <PageHeader title="Profil" description="Vos informations personnelles et les comptes que vous utilisez pour vous connecter." />
    <AccountProfileCard />
    <AccountLinkedAccountsCard :accounts="accounts" @changed="load" />
    <AccountOrganizationsCard />
  </template>
</template>
