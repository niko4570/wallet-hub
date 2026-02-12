import { HELIUS_API_BASE, HELIUS_API_KEY } from "../config/env";

const heliusBaseUrl = HELIUS_API_BASE.replace(/\/$/, "");

const getTransaction = async (signature: string): Promise<any> => {
  if (!HELIUS_API_KEY) {
    throw new Error("Helius API key not configured");
  }

  const response = await fetch(
    `${heliusBaseUrl}/v0/transactions?api-key=${HELIUS_API_KEY}`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ transactions: [signature] }),
    },
  );

  if (!response.ok) {
    throw new Error(`Helius API error: ${response.status}`);
  }

  const payload = await response.json();
  return payload;
};

export const heliusService = {
  getTransaction,
  isConfigured: !!HELIUS_API_KEY,
};
