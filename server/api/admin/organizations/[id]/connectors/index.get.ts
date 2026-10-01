import { listConnectors, listConnectorsSchema } from "../../../../../lib/connectors/connectors";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  return listConnectors(getRouterParam(event, "id")!, parseQuery(event, listConnectorsSchema));
});
