import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  LinkedWallet,
  TokenBalance,
  WalletActivity,
  WalletBalance,
  WalletGroup,
} from "../types/wallet";

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
  walletActivity: Record<string, WalletActivity[]>;
  isLoading: boolean;
  error: string | null;
  primaryWalletAddress: string | null;
  historicalBalances: Record<string, Array<{ timestamp: number; usd: number; sol: number }>>;

  // Actions
  updateHistoricalBalance: (address: string, balance: { timestamp: number; usd: number; sol: number }) => void;
  getHistoricalBalances: (address: string) => Array<{ timestamp: number; usd: number; sol: number }>;
  setLinkedWallets: (wallets: LinkedWallet[]) => void;
  setActiveWallet: (wallet: LinkedWallet | null) => void;
  setActiveWalletAddress: (address: string | null) => void;
  setPrimaryWalletAddress: (address: string | null) => void;
  updateBalance: (address: string, balance: number) => void;
  updateDetailedBalance: (balance: WalletBalance) => void;
  setMissingTokenPrices: (address: string, mints: string[]) => void;
  updateTotalBalance: () => void;
  setWalletActivity: (address: string, activity: WalletActivity[]) => void;
  clearWalletActivity: (address?: string) => void;
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
       primaryWalletAddress: null,
       walletGroups: [],
       balances: {},
       detailedBalances: {},
       missingTokenPrices: {},
       totalBalance: 0,
       totalUsdValue: 0,
       walletActivity: {},
       isLoading: false,
       error: null,
       historicalBalances: {},

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

       setPrimaryWalletAddress: (address) =>
         set((state) => {
           if (
             address &&
             !state.linkedWallets.some((wallet) => wallet.address === address)
           ) {
             return {};
           }
           return { primaryWalletAddress: address };
         }),

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
          const updatedActivity = { ...state.walletActivity };
          delete updatedActivity[address];

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
            primaryWalletAddress:
              state.primaryWalletAddress === address
                ? null
                : state.primaryWalletAddress,
            balances: updatedBalances,
            detailedBalances: updatedDetailedBalances,
            walletActivity: updatedActivity,
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

      setWalletActivity: (address, activity) => {
        const normalizedAddress = address.trim();
        const normalizedActivity = Array.isArray(activity)
          ? activity.slice(0, 50)
          : [];
        set((state) => ({
          walletActivity: {
            ...state.walletActivity,
            [normalizedAddress]: normalizedActivity,
          },
        }));
      },

      clearWalletActivity: (address) => {
        if (!address) {
          set({ walletActivity: {} });
          return;
        }
        const normalizedAddress = address.trim();
        set((state) => {
          const next = { ...state.walletActivity };
          delete next[normalizedAddress];
          return { walletActivity: next };
        });
      },

      clearAllWallets: () => {
        set({
          linkedWallets: [],
          activeWallet: null,
          activeWalletAddress: null,
          primaryWalletAddress: null,
          walletGroups: [],
          balances: {},
          detailedBalances: {},
          missingTokenPrices: {},
          totalBalance: 0,
          totalUsdValue: 0,
          walletActivity: {},
          error: null,
        });
      },

        updateHistoricalBalance: (address, balance) =>
          set((state) => {
            const existingBalances = state.historicalBalances[address] || [];
            
            // Check if we already have data for this timestamp
            const existingIndex = existingBalances.findIndex(
              (item) => item.timestamp === balance.timestamp
            );

            let updatedBalances;
            if (existingIndex >= 0) {
              // Update existing balance
              updatedBalances = [...existingBalances];
              updatedBalances[existingIndex] = balance;
            } else {
              // Add new balance
              updatedBalances = [...existingBalances, balance];
              // Sort by timestamp in ascending order
              updatedBalances.sort((a, b) => a.timestamp - b.timestamp);
              // Keep only the last 24 hours of data (1 hour intervals)
              const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
              updatedBalances = updatedBalances.filter(
                (item) => item.timestamp >= oneDayAgo
              );
            }

            return {
              historicalBalances: {
                ...state.historicalBalances,
                [address]: updatedBalances,
              },
            };
          }),

        getHistoricalBalances: (address) => {
          const state = get();
          return state.historicalBalances[address] || [];
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
      name: "wallet-storage",
      storage: createJSONStorage(() => AsyncStorage),
        partialize: (state) => ({
          linkedWallets: state.linkedWallets,
          activeWallet: state.activeWallet,
          activeWalletAddress: state.activeWalletAddress,
          primaryWalletAddress: state.primaryWalletAddress,
          walletGroups: state.walletGroups,
          historicalBalances: state.historicalBalances,
          walletActivity: state.walletActivity,
        }),
        version: 5,
        migrate: (persisted: any, version) => {
          if (!persisted) {
            return persisted;
          }

          let next = { ...persisted };

          if (version < 2) {
            next = {
              ...next,
              primaryWalletAddress: next.primaryWalletAddress ?? null,
              watchOnlyAccounts: next.watchOnlyAccounts ?? [],
              watchOnlyBalances: next.watchOnlyBalances ?? {},
            };
          }

          if (version < 3) {
            next = {
              ...next,
              watchOnlyActivity: next.watchOnlyActivity ?? {},
            };
          }

          if (version < 4) {
            next = {
              ...next,
              historicalBalances: next.historicalBalances ?? {},
            };
          }

          if (version < 5) {
            next = {
              ...next,
              historicalBalances: next.historicalBalances ?? {},
            };
          }

          delete next.watchOnlyAccounts;
          delete next.watchOnlyBalances;
          delete next.watchOnlyActivity;

          return next;
        },
      },
    ),
  );
