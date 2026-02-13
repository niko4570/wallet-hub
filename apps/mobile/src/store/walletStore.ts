import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  LinkedWallet,
  TokenBalance,
  WalletBalance,
  WalletGroup,
} from "../types/wallet";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

interface WalletState {
  // State
  linkedWallets: LinkedWallet[];
  activeWallet: LinkedWallet | null;
  activeWalletAddress: string | null;
  walletGroups: WalletGroup[];
  balances: Record<string, number>;
  detailedBalances: Record<string, WalletBalance>;
  missingTokenPrices: Record<string, string[]>;
  totalBalance: number;
  totalUsdValue: number;
  transactions: Record<string, any[]>;
  isLoading: boolean;
  error: string | null;

  // Actions
  setLinkedWallets: (wallets: LinkedWallet[]) => void;
  setActiveWallet: (wallet: LinkedWallet | null) => void;
  setActiveWalletAddress: (address: string | null) => void;
  updateBalance: (address: string, balance: number) => void;
  updateDetailedBalance: (balance: WalletBalance) => void;
  setMissingTokenPrices: (address: string, mints: string[]) => void;
  updateTotalBalance: () => void;
  addTransaction: (address: string, transaction: any) => void;
  setTransactions: (address: string, transactions: any[]) => void;
  clearTransactions: (address: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  addWallet: (wallet: LinkedWallet) => void;
  removeWallet: (address: string) => void;
  clearAllWallets: () => void;

  // Wallet group actions
  createWalletGroup: (name: string, walletAddresses: string[]) => void;
  updateWalletGroup: (id: string, name: string) => void;
  deleteWalletGroup: (id: string) => void;
  addWalletToGroup: (groupId: string, walletAddress: string) => void;
  removeWalletFromGroup: (groupId: string, walletAddress: string) => void;

  // Cross-wallet transfer actions
  transferBetweenWallets: (
    fromAddress: string,
    toAddress: string,
    amount: number,
  ) => Promise<string>;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      // Initial state
      linkedWallets: [],
      activeWallet: null,
      activeWalletAddress: null,
      walletGroups: [],
      balances: {},
      detailedBalances: {},
      missingTokenPrices: {},
      totalBalance: 0,
      totalUsdValue: 0,
      transactions: {},
      isLoading: false,
      error: null,

      // Actions
      setLinkedWallets: (wallets) => set({ linkedWallets: wallets }),

      setActiveWallet: (wallet) => {
        set({
          activeWallet: wallet,
          activeWalletAddress: wallet?.address || null,
        });
      },

      setActiveWalletAddress: (address) => {
        const wallet =
          get().linkedWallets.find((w) => w.address === address) || null;
        set({ activeWalletAddress: address, activeWallet: wallet });
      },

      updateBalance: (address, balance) => {
        set((state) => ({
          balances: {
            ...state.balances,
            [address]: balance,
          },
        }));
      },

      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),

      addWallet: (wallet) => {
        set((state) => {
          const existingWallet = state.linkedWallets.find(
            (w) => w.address === wallet.address,
          );
          if (existingWallet) {
            // Update existing wallet
            const updatedWallets = state.linkedWallets.map((w) =>
              w.address === wallet.address ? wallet : w,
            );
            return { linkedWallets: updatedWallets };
          } else {
            // Add new wallet
            return { linkedWallets: [...state.linkedWallets, wallet] };
          }
        });
      },

      removeWallet: (address) => {
        set((state) => {
          const updatedWallets = state.linkedWallets.filter(
            (w) => w.address !== address,
          );
          const updatedBalances = Object.fromEntries(
            Object.entries(state.balances).filter(([addr]) => addr !== address),
          );
          const updatedDetailedBalances = Object.fromEntries(
            Object.entries(state.detailedBalances).filter(
              ([addr]) => addr !== address,
            ),
          );
          const updatedTransactions = { ...state.transactions };
          delete updatedTransactions[address];

          return {
            linkedWallets: updatedWallets,
            activeWallet:
              state.activeWallet?.address === address
                ? updatedWallets[0] || null
                : state.activeWallet,
            activeWalletAddress:
              state.activeWalletAddress === address
                ? updatedWallets[0]?.address || null
                : state.activeWalletAddress,
            balances: updatedBalances,
            detailedBalances: updatedDetailedBalances,
            transactions: updatedTransactions,
          };
        });
        // Update total balance after removing wallet
        get().updateTotalBalance();
      },

      updateDetailedBalance: (balance) => {
        const tokens = Array.isArray(balance.tokens) ? balance.tokens : [];
        const normalizedTokens: TokenBalance[] = tokens.map((token) => ({
          mint: token.mint,
          symbol: token.symbol,
          name: token.name,
          balance: token.balance,
          usdValue: token.usdValue,
          decimals: token.decimals,
        }));

        set((state) => ({
          detailedBalances: {
            ...state.detailedBalances,
            [balance.address]: {
              ...balance,
              tokens: normalizedTokens,
            },
          },
        }));
        // Update total balance after updating detailed balance
        get().updateTotalBalance();
      },

      setMissingTokenPrices: (address, mints) => {
        set((state) => ({
          missingTokenPrices: {
            ...state.missingTokenPrices,
            [address]: mints,
          },
        }));
      },

      updateTotalBalance: () => {
        const state = get();
        let totalBalance = 0;
        let totalUsdValue = 0;

        Object.values(state.detailedBalances).forEach((balance) => {
          totalBalance += balance.balance;
          totalUsdValue += balance.usdValue;
        });

        set({ totalBalance, totalUsdValue });
      },

      addTransaction: (address, transaction) => {
        set((state) => {
          const walletTransactions = state.transactions[address] || [];
          return {
            transactions: {
              ...state.transactions,
              [address]: [transaction, ...walletTransactions],
            },
          };
        });
      },

      setTransactions: (address, transactions) => {
        set((state) => ({
          transactions: {
            ...state.transactions,
            [address]: transactions,
          },
        }));
      },

      clearTransactions: (address) => {
        set((state) => {
          const newTransactions = { ...state.transactions };
          delete newTransactions[address];
          return { transactions: newTransactions };
        });
      },

      clearAllWallets: () => {
        set({
          linkedWallets: [],
          activeWallet: null,
          activeWalletAddress: null,
          walletGroups: [],
          balances: {},
          detailedBalances: {},
          missingTokenPrices: {},
          totalBalance: 0,
          totalUsdValue: 0,
          transactions: {},
          error: null,
        });
      },

      // Wallet group actions
      createWalletGroup: (name, walletAddresses) => {
        set((state) => {
          const newGroup: WalletGroup = {
            id: `group_${Date.now()}`,
            name,
            walletAddresses,
            createdAt: new Date().toISOString(),
          };

          // Update wallets with group information
          const updatedWallets = state.linkedWallets.map((wallet) => {
            if (walletAddresses.includes(wallet.address)) {
              return {
                ...wallet,
                groupId: newGroup.id,
                groupName: newGroup.name,
              };
            }
            return wallet;
          });

          return {
            walletGroups: [...state.walletGroups, newGroup],
            linkedWallets: updatedWallets,
          };
        });
      },

      updateWalletGroup: (id, name) => {
        set((state) => {
          const updatedGroups = state.walletGroups.map((group) => {
            if (group.id === id) {
              return { ...group, name };
            }
            return group;
          });

          // Update wallets with new group name
          const updatedWallets = state.linkedWallets.map((wallet) => {
            if (wallet.groupId === id) {
              return { ...wallet, groupName: name };
            }
            return wallet;
          });

          return {
            walletGroups: updatedGroups,
            linkedWallets: updatedWallets,
          };
        });
      },

      deleteWalletGroup: (id) => {
        set((state) => {
          // Update wallets to remove group information
          const updatedWallets = state.linkedWallets.map((wallet) => {
            if (wallet.groupId === id) {
              const { groupId, groupName, ...rest } = wallet;
              return rest;
            }
            return wallet;
          });

          return {
            walletGroups: state.walletGroups.filter((group) => group.id !== id),
            linkedWallets: updatedWallets,
          };
        });
      },

      addWalletToGroup: (groupId, walletAddress) => {
        set((state) => {
          const group = state.walletGroups.find((g) => g.id === groupId);
          if (!group) return state;

          const updatedGroup = {
            ...group,
            walletAddresses: [...group.walletAddresses, walletAddress],
          };

          const updatedGroups = state.walletGroups.map((g) =>
            g.id === groupId ? updatedGroup : g,
          );

          const updatedWallets = state.linkedWallets.map((wallet) => {
            if (wallet.address === walletAddress) {
              return {
                ...wallet,
                groupId: groupId,
                groupName: group.name,
              };
            }
            return wallet;
          });

          return {
            walletGroups: updatedGroups,
            linkedWallets: updatedWallets,
          };
        });
      },

      removeWalletFromGroup: (groupId, walletAddress) => {
        set((state) => {
          const updatedGroup = state.walletGroups.map((group) => {
            if (group.id === groupId) {
              return {
                ...group,
                walletAddresses: group.walletAddresses.filter(
                  (addr) => addr !== walletAddress,
                ),
              };
            }
            return group;
          });

          const updatedWallets = state.linkedWallets.map((wallet) => {
            if (
              wallet.address === walletAddress &&
              wallet.groupId === groupId
            ) {
              const { groupId, groupName, ...rest } = wallet;
              return rest;
            }
            return wallet;
          });

          return {
            walletGroups: updatedGroup,
            linkedWallets: updatedWallets,
          };
        });
      },

      // Cross-wallet transfer actions
      transferBetweenWallets: async (fromAddress, toAddress, amount) => {
        // This is a placeholder implementation
        // In a real app, you would use the wallet adapter to sign and send the transaction
        set({ isLoading: true, error: null });

        try {
          // TODO: Implement real cross-wallet transfer using wallet adapter
          throw new Error("Cross-wallet transfer not implemented yet");
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : "Transfer failed",
            isLoading: false,
          });
          throw error;
        }
      },
    }),
    {
      name: 'wallet-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        linkedWallets: state.linkedWallets,
        activeWalletAddress: state.activeWalletAddress,
        walletGroups: state.walletGroups
      }),
      version: 1,
      migrate: (persisted, version) => {
        if (version === 0) {
          // Add migration logic if needed in the future
        }
        return persisted;
      },
    },
  ),
);
