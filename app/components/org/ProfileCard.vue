<script setup lang="ts">
import { toast } from "vue-sonner";
import { ImageUp, Trash2 } from "lucide-vue-next";
import { authClient } from "~/lib/auth-client";
import { errorMessage } from "~/lib/errors";
import type { ManagedOrganization } from "~/lib/org";

const LOGO_SIZE = 256;
const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];

const props = defineProps<{ org: ManagedOrganization; appLabels: string; editable: boolean }>();
const emit = defineEmits<{ changed: [] }>();

const name = ref(props.org.name);
const logo = ref<string | null | undefined>(undefined);
const saving = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

const preview = computed(() => (logo.value === undefined ? props.org.logoUrl : logo.value));
const dirty = computed(() => name.value.trim() !== props.org.name || logo.value !== undefined);

watch(
  () => props.org,
  (org) => {
    name.value = org.name;
    logo.value = undefined;
  },
);

function resize(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      const scale = Math.min(1, LOGO_SIZE / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");

      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/webp", 0.9));
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("INVALID_LOGO"));
    };

    image.src = url;
  });
}

async function pick(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];

  (event.target as HTMLInputElement).value = "";
  if (!file) return;
  if (!ACCEPTED.includes(file.type)) return toast.error(errorMessage({ code: "INVALID_LOGO" }));
  try {
    logo.value = await resize(file);
  } catch {
    toast.error(errorMessage({ code: "INVALID_LOGO" }));
  }
}

async function save() {
  saving.value = true;
  const data: { name?: string; logo?: string } = {};

  if (name.value.trim() !== props.org.name) data.name = name.value.trim();
  if (logo.value !== undefined) data.logo = logo.value ?? "";
  const res = await authClient.organization.update({ organizationId: props.org.id, data });

  saving.value = false;
  if (res.error) return toast.error(errorMessage(res.error));
  toast.success("Organisation mise à jour.");
  emit("changed");
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Organisation</CardTitle>

      <CardDescription>
        {{
          editable
            ? "Le nom et le logo s'affichent pour tous les membres."
            : "Ces informations sont gérées par les gérants de l'organisation."
        }}
      </CardDescription>
    </CardHeader>

    <CardContent>
      <form
        v-if="editable"
        class="grid gap-5 sm:max-w-md"
        @submit.prevent="save"
      >
        <div class="flex items-center gap-4">
          <OrgLogo
            :name="name || org.name"
            :logo-url="preview"
            class="size-16 rounded-xl text-xl"
          />

          <div class="flex flex-wrap gap-2">
            <input
              ref="fileInput"
              type="file"
              :accept="ACCEPTED.join(',')"
              class="hidden"
              @change="pick"
            />

            <Button
              type="button"
              variant="outline"
              size="sm"
              @click="fileInput?.click()"
            >
              <ImageUp />
              Changer le logo
            </Button>

            <Button
              v-if="preview"
              type="button"
              variant="ghost"
              size="sm"
              @click="logo = null"
            >
              <Trash2 />
              Retirer
            </Button>
          </div>
        </div>

        <FormField
          v-model="name"
          label="Nom"
          required
        />

        <div class="text-sm">
          <p class="text-muted-foreground">Applications autorisées</p>

          <p>{{ appLabels }}</p>
        </div>

        <div>
          <Button
            type="submit"
            :disabled="saving || !dirty || !name.trim()"
          >
            Enregistrer
          </Button>
        </div>
      </form>

      <dl
        v-else
        class="divide-y rounded-lg border text-sm"
      >
        <div class="flex items-center justify-between gap-4 px-4 py-3">
          <dt class="text-muted-foreground">Nom</dt>

          <dd class="flex items-center gap-2 font-medium">
            <OrgLogo
              :name="org.name"
              :logo-url="org.logoUrl"
              class="size-6 rounded text-xs"
            />
            {{ org.name }}
          </dd>
        </div>

        <div class="flex justify-between gap-4 px-4 py-3">
          <dt class="text-muted-foreground">Applications autorisées</dt>

          <dd>{{ appLabels }}</dd>
        </div>
      </dl>
    </CardContent>
  </Card>
</template>
