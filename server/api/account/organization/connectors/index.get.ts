import { listConnectors, listConnectorsSchema } from "../../../../lib/connectors/connectors";

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireConnectorAccess(event);

  return listConnectors(organizationId, parseQuery(event, listConnectorsSchema));
});
