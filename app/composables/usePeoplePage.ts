import { watchDebounced } from "@vueuse/core";
import type { MaybeRefOrGetter, Ref } from "vue";
import { toast } from "vue-sonner";
import { errorMessage } from "~/lib/errors";
import type { PeopleFilter, PeoplePage } from "~/lib/org";

export function usePeoplePage(endpoint: MaybeRefOrGetter<string>, filter: Ref<PeopleFilter>, pageSize = 25) {
  const q = ref("");
  const page = ref(0);
  const data = ref<PeoplePage | null>(null);
  const loading = ref(false);
  let requestId = 0;

  async function load() {
    const current = ++requestId;

    loading.value = true;
    try {
      const res = await $fetch<PeoplePage>(toValue(endpoint), {
        query: { q: q.value, filter: filter.value, limit: pageSize, offset: page.value * pageSize },
      });

      if (current !== requestId) return;
      if (!res.rows.length && page.value > 0) {
        page.value = Math.max(0, Math.ceil(res.total / pageSize) - 1);

        return;
      }

      data.value = res;
    } catch (e) {
      if (current === requestId) toast.error(errorMessage((e as { data?: unknown }).data ?? e));
    } finally {
      if (current === requestId) loading.value = false;
    }
  }

  function reload() {
    if (page.value === 0) load();
    else page.value = 0;
  }

  watchDebounced(q, reload, { debounce: 250 });
  watch(filter, reload);
  watch(page, load);
  watch(
    () => toValue(endpoint),
    () => {
      data.value = null;
      reload();
    },
  );
  onMounted(load);

  return { q, page, data, loading, pageSize, load, reload };
}
