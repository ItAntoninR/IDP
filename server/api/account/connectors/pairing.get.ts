import { z } from "zod";
import { describePairing, userCodeSchema } from "../../../lib/connectors/pairing";

const querySchema = z.object({ code: userCodeSchema });

export default defineEventHandler(async (event) => {
  const session = await requireSession(event);

  await enforceRateLimit(event, "connector-pairing-lookup", { windowSeconds: 60, max: 20 }, session.user.id);
  const { code } = parseQuery(event, querySchema);
  const pairing = await describePairing(code);

  if (!pairing) throw apiError(404, "PAIRING_NOT_FOUND", "Unknown or expired pairing code");

  return { pairing };
});
