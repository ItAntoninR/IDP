import { authClient } from "~/lib/auth-client";
import { errorMessage } from "~/lib/errors";
import { parsePermission, type DynamicRole, type FullOrganization, type OrgRights } from "~/lib/org";
import type { OrganizationInsights } from "~/lib/types";

export function useManagedOrganization() {
  const { load: loadContext } = useAccountContext();
  const org = useState<FullOrganization | null>("managed-org", () => null);
  const roles = useState<DynamicRole[]>("managed-org-roles", () => []);
  const rights = useState<OrgRights | null>("managed-org-rights", () => null);
  const insights = useState<OrganizationInsights | null>("managed-org-insights", () => null);
  const appLabels = useState("managed-org-apps", () => "aucune");
  const error = ref("");

  const roleNames = computed(() => ["member", "owner", ...roles.value.map((r) => r.role)]);

  async function refresh() {
    const id = org.value?.id ?? (await loadContext()).active?.id;
    if (!id) return;
    const has = (permissions: Record<string, string[]>) =>
      authClient.organization.hasPermission({ organizationId: id, permissions } as never).then((r) => !!r.data?.success);
    const [full, roleList, members, invite, ac, settings, stats] = await Promise.all([
      authClient.organization.getFullOrganization({ query: { organizationId: id } }),
      authClient.organization.listRoles({ query: { organizationId: id } }),
      has({ member: ["update"] }),
      has({ invitation: ["create"] }),
      has({ ac: ["create"] }),
      has({ organization: ["update"] }),
      $fetch<OrganizationInsights>("/api/account/organization").catch(() => null),
    ]);
    if (full.error) {
      error.value = errorMessage(full.error);
      return;
    }
    org.value = full.data as unknown as FullOrganization;
    roles.value = ((roleList.data ?? []) as unknown as { id: string; role: string; permission: unknown }[]).map((r) => ({
      ...r,
      permission: parsePermission(r.permission),
    }));
    rights.value = { members, invite, roles: ac, settings };
    insights.value = stats;
  }

  async function load() {
    error.value = "";
    try {
      const context = await loadContext();
      if (!context.active?.canManage) return navigateTo("/", { replace: true });
      appLabels.value = context.active.apps.map((a) => a.label).join(", ") || "aucune";
      if (org.value?.id !== context.active.id) {
        org.value = null;
        rights.value = null;
      }
      if (!org.value) await refresh();
      else refresh();
    } catch (e) {
      error.value = errorMessage(e);
    }
  }

  return { org, roles, rights, insights, appLabels, roleNames, error, load, refresh };
}
