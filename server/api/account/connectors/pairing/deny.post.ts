import { denyPairing, pairingDecisionSchema } from "../../../../lib/connectors/pairing";

const denySchema = pairingDecisionSchema.pick({ userCode: true, organizationId: true });

export default defineEventHandler(async (event) => {
  const session = await requireSession(event);
  const input = await parseBody(event, denySchema);

  await requirePairingPermission(event, session, input.organizationId);
  const result = await denyPairing(input, actorOf(session));

  if (!result.ok) throw pairingDecisionError(result.code);

  return { denied: true };
});
