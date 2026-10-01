import { renameConnector, renameConnectorSchema } from "../../../../lib/connectors/connectors";

export default defineEventHandler(async (event) => {
  const { session, organizationId } = await requireConnectorAccess(event, "update");
  const { name } = await parseBody(event, renameConnectorSchema);
  const result = await renameConnector(organizationId, getRouterParam(event, "id")!, name, actorOf(session));

  if (!result.ok) throw connectorManagementError(result.code);

  return { renamed: true };
});
