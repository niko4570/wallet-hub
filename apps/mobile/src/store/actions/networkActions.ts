import { clusterApiUrl } from "@solana/web3.js";
import type { SolanaStoreState } from "../solanaStore";
import { rpcService, walletService } from "../../services";
import { HELIUS_RPC_URL, HELIUS_API_KEY } from "../../config/env";
import { SecureConnection } from "../../services/solana/secureConnection";

type Network = "mainnet-beta" | "devnet" | "testnet";

export const createNetworkActions = (
  set: any,
  get: () => SolanaStoreState,
) => ({
  getRpcUrl: (network: Network) => {
    const overrideRpcUrl = process.env?.EXPO_PUBLIC_SOLANA_RPC_URL;
    const devnetOverrideRpcUrl =
      process.env?.EXPO_PUBLIC_SOLANA_DEVNET_RPC_URL;
    const testnetOverrideRpcUrl =
      process.env?.EXPO_PUBLIC_SOLANA_TESTNET_RPC_URL;

    if (overrideRpcUrl && overrideRpcUrl.length > 0) {
      return overrideRpcUrl;
    }

    if (network === "mainnet-beta") {
      if (HELIUS_API_KEY && HELIUS_API_KEY.length > 0) {
        return HELIUS_RPC_URL;
      }
      return clusterApiUrl(network);
    } else if (
      network === "devnet" &&
      devnetOverrideRpcUrl &&
      devnetOverrideRpcUrl.length > 0
    ) {
      return devnetOverrideRpcUrl;
    } else if (
      network === "testnet" &&
      testnetOverrideRpcUrl &&
      testnetOverrideRpcUrl.length > 0
    ) {
      return testnetOverrideRpcUrl;
    } else {
      return clusterApiUrl(network);
    }
  },

  setNetwork: (network: Network) => {
    const rpcUrl = get().getRpcUrl(network);
    const newConnection = new SecureConnection(rpcUrl, {
      commitment: "confirmed",
      ...(HELIUS_API_KEY && HELIUS_API_KEY.length > 0
        ? { apiKey: HELIUS_API_KEY }
        : {}),
    });

    set({
      network,
      connection: newConnection,
    });

    rpcService.setConnection(newConnection);
    walletService.setNetwork(network, newConnection);

    const state = get();
    if (state.linkedWallets.length > 0) {
      state.linkedWallets.forEach((wallet) => {
        get()
          .refreshBalance(wallet.address)
          .catch((err) => {
            console.warn(
              "Balance refresh failed after network switch",
              err,
            );
          });
      });
    }
  },
});
