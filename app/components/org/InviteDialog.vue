<script setup lang="ts">
import { toast } from "vue-sonner";
import { authClient } from "~/lib/auth-client";
import { errorMessage } from "~/lib/errors";
import { roleOptions } from "~/lib/labels";

const open = defineModel<boolean>("open", { required: true });
const props = defineProps<{ organizationId: string; organizationName: string; roles: string[] }>();
const emit = defineEmits<{ invited: [] }>();

const email = ref("");
const role = ref("member");
const loading = ref(false);

watch(open, (value) => {
  if (value) {
    email.value = "";
    role.value = "member";
  }
});

async function submit() {
  loading.value = true;
  const res = await authClient.organization.inviteMember({
    email: email.value,
    role: role.value as "member",
    organizationId: props.organizationId,
  });

  loading.value = false;
  if (res.error) return toast.error(errorMessage(res.error));
  toast.success(`Invitation envoyée à ${email.value}.`);
  open.value = false;
  emit("invited");
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>Inviter un membre</DialogTitle>

        <DialogDescription>
          La personne recevra un email pour rejoindre {{ organizationName }}. L'invitation est valable 7 jours.
        </DialogDescription>
      </DialogHeader>

      <form
        class="space-y-5"
        @submit.prevent="submit"
      >
        <FormField
          v-model="email"
          label="Email"
          type="email"
          placeholder="nom@entreprise.fr"
          required
        />

        <div class="grid gap-2">
          <Label for="invite-role">Rôle</Label>

          <AppSelect
            id="invite-role"
            v-model="role"
            :options="roleOptions(roles)"
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            @click="open = false"
          >
            Annuler
          </Button>

          <Button
            type="submit"
            :disabled="loading"
          >
            Envoyer l'invitation
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
