import { PublicKey } from "@solana/web3.js";
import { Buffer } from "buffer";

const BASE58_REGEX = /^[A-HJ-NP-Za-km-z1-9]+$/;
const BASE64_REGEX = /^[A-Za-z0-9+/=]+$/;
const HEX_REGEX = /^[0-9a-fA-F]+$/;

const toBase58 = (input: string | Uint8Array): string => {
  const key = new PublicKey(input);
  return key.toBase58();
};

/**
 * Normalize raw addresses that may come back as base58, base64, or prefixed values.
 * Always returns a base58-encoded public key string.
 */
export const decodeWalletAddress = (rawAddress: string): string => {
  const normalized = rawAddress.trim().replace(/^solana:/i, "");

  const attempts: Array<{ label: string; value: string | Uint8Array }> = [
    { label: "direct", value: normalized },
  ];

  // Some wallets may return addresses with non-base58 characters mixed in
  const cleanedBase58 = normalized.replace(/[^A-HJ-NP-Za-km-z1-9]/g, "");
  if (cleanedBase58 && cleanedBase58 !== normalized) {
    attempts.push({ label: "cleaned-base58", value: cleanedBase58 });
  }

  // Handle base64-encoded public keys (32 bytes)
  if (BASE64_REGEX.test(normalized)) {
    try {
      const decoded = Buffer.from(normalized, "base64");
      if (decoded.length === 32) {
        attempts.push({ label: "base64", value: decoded });
      }
    } catch (error) {
      console.warn("Base64 decode failed for wallet address", error);
    }
  }

  // Handle hex-encoded public keys (64 hex chars -> 32 bytes)
  if (HEX_REGEX.test(normalized) && normalized.length === 64) {
    try {
      const decoded = Buffer.from(normalized, "hex");
      attempts.push({ label: "hex", value: decoded });
    } catch (error) {
      console.warn("Hex decode failed for wallet address", error);
    }
  }

  const errors: Record<string, unknown> = {};
  for (const attempt of attempts) {
    try {
      const base58 = toBase58(attempt.value);
      if (attempt.label !== "direct") {
        console.log(`Decoded wallet address via ${attempt.label} fallback`);
      }
      return base58;
    } catch (error) {
      errors[attempt.label] = error;
    }
  }

  console.error("Failed to normalize wallet address; giving up", {
    raw: rawAddress,
    errors,
  });
  throw new Error("Invalid Solana address format - must be valid base58");
};
