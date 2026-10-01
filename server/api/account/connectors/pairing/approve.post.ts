import { approvePairing, pairingDecisionSchema } from "../../../../lib/connectors/pairing";

export default defineEventHandler(async (event) => {
  const session = await requireSession(event);
  const input = await parseBody(event, pairingDecisionSchema);

  await requirePairingPermission(event, session, input.organizationId);
  const result = await approvePairing(input, actorOf(session));

  if (!result.ok) throw pairingDecisionError(result.code);

  return { connector: { id: result.connectorId, name: result.name } };
});
