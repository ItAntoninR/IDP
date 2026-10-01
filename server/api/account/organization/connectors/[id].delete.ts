import { revokeConnector } from "../../../../lib/connectors/connectors";

export default defineEventHandler(async (event) => {
  const { session, organizationId } = await requireConnectorAccess(event, "delete");
  const result = await revokeConnector(organizationId, getRouterParam(event, "id")!, actorOf(session));

  if (!result.ok) throw connectorManagementError(result.code);

  return { revoked: true };
});
