import { pairingRequestSchema, requestPairing } from "../../lib/connectors/pairing";

export default defineEventHandler(async (event) => {
  await enforceRateLimit(event, "connector-pairing", { windowSeconds: 60, max: 10 });
  const input = await parseBody(event, pairingRequestSchema);
  const result = await requestPairing(input);

  if (!result.ok) throw apiError(400, result.code, "The public key is not a valid P-256 key");
  setResponseHeader(event, "cache-control", "no-store");

  return result.pairing;
});
