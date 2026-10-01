import { pairingTokenSchema, pollPairing, type PollError } from "../../../lib/connectors/pairing";

const DESCRIPTIONS: Record<PollError, string> = {
  authorization_pending: "The pairing has not been approved yet",
  slow_down: "Polling too fast, increase the interval by 5 seconds",
  expired_token: "The pairing expired, start a new one",
  access_denied: "The pairing was denied",
  invalid_grant: "Unknown or already used device code",
};

export default defineEventHandler(async (event) => {
  await enforceRateLimit(event, "connector-pairing-token", { windowSeconds: 60, max: 30 });
  const { deviceCode } = await parseBody(event, pairingTokenSchema);
  const result = await pollPairing(deviceCode);

  setResponseHeader(event, "cache-control", "no-store");
  if (result.ok) return result.credentials;
  setResponseStatus(event, 400);

  return { error: result.error, error_description: DESCRIPTIONS[result.error] };
});
