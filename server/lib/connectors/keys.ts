import { createHash, createPublicKey } from "node:crypto";
import { z } from "zod";
import type { ConnectorPublicKey } from "../db/app-schema";

const PRIVATE_MEMBERS = ["d", "p", "q", "dp", "dq", "qi", "oth", "k"];

const coordinate = z
  .string()
  .length(43)
  .regex(/^[A-Za-z0-9_-]+$/);

export const connectorPublicKeySchema = z
  .object({
    kty: z.literal("EC"),
    crv: z.literal("P-256"),
    x: coordinate,
    y: coordinate,
    alg: z.literal("ES256").optional(),
    use: z.literal("sig").optional(),
    kid: z.string().max(200).optional(),
  })
  .loose()
  .refine((key) => !PRIVATE_MEMBERS.some((member) => member in key), {
    message: "Only the public key may be sent",
    path: ["d"],
  });

export type ConnectorPublicKeyInput = z.infer<typeof connectorPublicKeySchema>;

const thumbprint = (key: { crv: string; kty: string; x: string; y: string }) =>
  createHash("sha256")
    .update(JSON.stringify({ crv: key.crv, kty: key.kty, x: key.x, y: key.y }))
    .digest("base64url");

const isOnCurve = (key: { kty: string; crv: string; x: string; y: string }) => {
  try {
    createPublicKey({ key, format: "jwk" });

    return true;
  } catch {
    return false;
  }
};

export function normalizePublicKey(input: ConnectorPublicKeyInput): ConnectorPublicKey | null {
  const key = { kty: input.kty, crv: input.crv, x: input.x, y: input.y };

  if (!isOnCurve(key)) return null;

  return { ...key, alg: "ES256", use: "sig", kid: thumbprint(key) };
}
