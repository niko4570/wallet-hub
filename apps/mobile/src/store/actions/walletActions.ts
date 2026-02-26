import type { AuthorizationResult } from "@solana-mobile/mobile-wallet-adapter-protocol";
import type {
  SilentReauthorizationRecord,
} from "@wallethub/contracts";
import { transact, type Web3MobileWallet } from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import type { SolanaStoreState } from "../solanaStore";
import { authorizationApi, walletService } from "../../services";
import { requireBiometricApproval } from "../../security/biometrics";
import type { LinkedWallet, AuthorizationPreview } from "../../types/wallet";
import { normalizeAuthorization } from "../utils/authorizationUtils";
import { mapCapabilities, DEFAULT_CAPABILITIES } from "../utils/capabilitiesUtils";
import { APP_IDENTITY } from "../utils/constants";

export const createWalletActions = (
  set: any,
  get: () => SolanaStoreState,
) => ({
  startAuthorization: async (): Promise<AuthorizationPreview> => {
    try {
      set({ isLoading: true, error: null });
      const result = await walletService.startWalletAuthorization();
      set({ isLoading: false });
      return result;
    } catch (error) {
      console.error("Wallet authorization failed", error);
      const errorMessage =
        error instanceof Error ? error.message : "Authorization failed";
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  finalizeAuthorization: async (
    preview: AuthorizationPreview,
    selectedAddresses?: string[],
  ): Promise<LinkedWallet[]> => {
    try {
      set({ isLoading: true, error: null });
      const accountsToLink =
        await walletService.finalizeWalletAuthorization(
          preview,
          selectedAddresses,
        );

      set((prev: SolanaStoreState) => {
        const updatedWallets = [...prev.linkedWallets];
        accountsToLink.forEach((walletAccount) => {
          const existingIndex = updatedWallets.findIndex(
            (entry) => entry.address === walletAccount.address,
          );
          if (existingIndex >= 0) {
            updatedWallets[existingIndex] = {
              ...updatedWallets[existingIndex],
              ...walletAccount,
            };
          } else {
            updatedWallets.push(walletAccount);
          }
        });

        const activeWallet = prev.activeWallet || accountsToLink[0];

        return {
          linkedWallets: updatedWallets,
          activeWallet,
          activeWalletAddress: activeWallet?.address || null,
          isAuthenticated: updatedWallets.length > 0,
          isLoading: false,
        };
      });

      const state = get();
      await Promise.all(
        accountsToLink.map((walletAccount) =>
          get()
            .refreshBalance(walletAccount.address)
            .catch((err) => {
              console.warn("Balance refresh failed post-connect", err);
            }),
        ),
      );

      return accountsToLink;
    } catch (error) {
      console.error("Error finalizing authorization:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Authorization failed";
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  registerPrimaryWallet: async (): Promise<LinkedWallet[]> => {
    try {
      set({ isLoading: true, error: null });
      await requireBiometricApproval("Authenticate to register wallet", {
        allowSessionReuse: true,
      });
      const preview = await get().startAuthorization();
      const accounts = await get().finalizeAuthorization(preview);

      if (accounts.length > 0) {
        const { useWalletBaseStore } = require("../walletStore");
        const walletState = useWalletBaseStore.getState();
        walletState.setPrimaryWalletAddress(accounts[0].address);
      }

      return accounts;
    } catch (error) {
      console.error("Register primary wallet failed", error);
      const errorMessage =
        error instanceof Error ? error.message : "Registration failed";
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  silentRefreshAuthorization: async (
    address?: string,
  ): Promise<SilentReauthorizationRecord | null> => {
    const state = get();
    const targetAddress = address ?? state.activeWallet?.address;
    if (!targetAddress) {
      throw new Error("Select a wallet to refresh authorization");
    }

    const walletEntry = state.linkedWallets.find(
      (wallet) => wallet.address === targetAddress,
    );
    if (!walletEntry) {
      throw new Error("Wallet not linked");
    }

    let reauthMethod: "silent" | "prompted" = "silent";

    try {
      set({ isLoading: true, error: null });
      const result = await transact(async (wallet: Web3MobileWallet) => {
        const capabilities = await wallet.getCapabilities().catch((err) => {
          console.warn("Capability probe failed", err);
          return null;
        });

        let authorization: AuthorizationResult;
        try {
          authorization = await wallet.reauthorize({
            identity: APP_IDENTITY,
            auth_token: walletEntry.authToken,
          });
        } catch (error) {
          reauthMethod = "prompted";
          const state = get();
          authorization = await wallet.authorize({
            identity: APP_IDENTITY,
            chain: `solana:${state.network}`,
            features: [
              "solana:signAndSendTransactions",
              "solana:signTransactions",
              "solana:signMessages",
            ],
          });
        }

        return { authorization, capabilities };
      });

      const normalizedAccounts = normalizeAuthorization(result.authorization);

      set((prev: SolanaStoreState) => {
        const updatedWallets = [...prev.linkedWallets];
        normalizedAccounts.forEach((walletAccount) => {
          const existingIndex = updatedWallets.findIndex(
            (entry) => entry.address === walletAccount.address,
          );
          if (existingIndex >= 0) {
            updatedWallets[existingIndex] = {
              ...updatedWallets[existingIndex],
              ...walletAccount,
            };
          } else {
            updatedWallets.push(walletAccount);
          }
        });

        return {
          linkedWallets: updatedWallets,
        };
      });

      const refreshedAccount =
        normalizedAccounts.find(
          (account) => account.address === walletEntry.address,
        ) ?? normalizedAccounts[0];

      if (!refreshedAccount) {
        throw new Error("Wallet did not return any accounts");
      }

      const recorded = await authorizationApi
        .recordSilentReauthorization({
          walletAddress: refreshedAccount.address,
          walletAppId:
            refreshedAccount.walletAppId ?? walletEntry.walletAppId,
          walletName: refreshedAccount.walletName ?? walletEntry.walletName,
          authToken: refreshedAccount.authToken,
          method: reauthMethod,
          capabilities: mapCapabilities(result.capabilities),
        })
        .catch((err) => {
          console.warn("Failed to persist silent re-authorization", err);
          return null;
        });

      set({ isLoading: false });
      return recorded;
    } catch (error) {
      console.error("Silent re-authorization failed", error);
      try {
        await authorizationApi.recordSilentReauthorization({
          walletAddress: walletEntry.address,
          walletAppId: walletEntry.walletAppId,
          walletName: walletEntry.walletName,
          method: reauthMethod,
          capabilities: { ...DEFAULT_CAPABILITIES },
          error: error instanceof Error ? error.message : "unknown_error",
        });
      } catch (persistError) {
        console.warn(
          "Failed to record silent re-authorization failure",
          persistError,
        );
      }

      const errorMessage =
        error instanceof Error ? error.message : "Re-authorization failed";
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  disconnect: async (address?: string) => {
    const state = get();
    const targetAddress = address ?? state.activeWallet?.address;
    if (!targetAddress) return;

    const walletEntry = state.linkedWallets.find(
      (wallet) => wallet.address === targetAddress,
    );

    if (walletEntry) {
      const remainingWithToken = state.linkedWallets.filter(
        (wallet) =>
          wallet.authToken === walletEntry.authToken &&
          wallet.address !== targetAddress,
      );
      if (remainingWithToken.length === 0) {
        try {
          await transact(async (wallet) => {
            await wallet.deauthorize({ auth_token: walletEntry.authToken });
          });
        } catch (error) {
          console.warn("Deauthorize failed (ignored)", error);
        }
      }
    }

    set((prev: SolanaStoreState) => {
      const nextWallets = prev.linkedWallets.filter(
        (wallet) => wallet.address !== targetAddress,
      );
      const nextActiveWallet =
        prev.activeWallet?.address === targetAddress
          ? nextWallets[0] || null
          : prev.activeWallet;

      const nextBalances = { ...prev.balances };
      delete nextBalances[targetAddress];

      const nextDetailedBalances = { ...prev.detailedBalances };
      delete nextDetailedBalances[targetAddress];

      return {
        linkedWallets: nextWallets,
        activeWallet: nextActiveWallet,
        activeWalletAddress: nextActiveWallet?.address || null,
        isAuthenticated: nextWallets.length > 0,
        balances: nextBalances,
        detailedBalances: nextDetailedBalances,
      };
    });

    const { useWalletBaseStore } = require("../walletStore");
    const walletStore = useWalletBaseStore.getState();
    walletStore.removeWallet(targetAddress);
  },

  selectActiveWallet: (address: string) => {
    const state = get();
    const wallet =
      state.linkedWallets.find((w) => w.address === address) || null;
    set({
      activeWallet: wallet,
      activeWalletAddress: wallet?.address || null,
      isAuthenticated: !!wallet,
    });
  },
});
