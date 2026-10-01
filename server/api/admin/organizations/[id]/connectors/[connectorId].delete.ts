import { revokeConnector } from "../../../../../lib/connectors/connectors";

export default defineEventHandler(async (event) => {
  const session = await requireAdmin(event);
  const result = await revokeConnector(
    getRouterParam(event, "id")!,
    getRouterParam(event, "connectorId")!,
    actorOf(session),
  );

  if (!result.ok) throw connectorManagementError(result.code);

  return { revoked: true };
});
