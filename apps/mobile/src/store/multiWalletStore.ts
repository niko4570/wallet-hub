import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { WalletSession, MultiWalletState, MultiWalletActions } from "../types/multiWallet";

/**
 * Multi-wallet Zustand store for managing multiple independent wallet sessions.
 * Each wallet connection maintains its own session with separate authorization.
 */
export const useMultiWalletStore = create<
  MultiWalletState & MultiWalletActions & {
    /** Internal helper to generate unique session IDs */
    generateSessionId: () => string;
    /** Internal helper to get session by address */
    _getSessionByAddress: (address: string) => WalletSession | undefined;
  }
>()(
  persist(
    (set, get) => ({
      sessions: {},
      sessionOrder: [],
      activeSessionId: null,
      isLoading: false,
      error: null,

      generateSessionId: () => {
        return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      },

      _getSessionByAddress: (address: string) => {
        const state = get();
        return Object.values(state.sessions).find(
          (session) => session.address === address
        );
      },

      addSession: (session: WalletSession) => {
        set((state) => {
          const existingSession = state.sessions[session.sessionId];
          
          if (existingSession) {
            // Update existing session
            return {
              sessions: {
                ...state.sessions,
                [session.sessionId]: {
                  ...existingSession,
                  ...session,
                  lastActivityAt: Date.now(),
                },
              },
            };
          }

          // Add new session
          return {
            sessions: {
              ...state.sessions,
              [session.sessionId]: session,
            },
            sessionOrder: [...state.sessionOrder, session.sessionId],
            // Set as active if no active session
            activeSessionId: state.activeSessionId || session.sessionId,
          };
        });
      },

      removeSession: (sessionId: string) => {
        set((state) => {
          const { [sessionId]: removed, ...remainingSessions } = state.sessions;
          const newSessionOrder = state.sessionOrder.filter((id) => id !== sessionId);
          
          // Update active session if needed
          let newActiveSessionId = state.activeSessionId;
          if (state.activeSessionId === sessionId) {
            newActiveSessionId = newSessionOrder[0] || null;
          }

          return {
            sessions: remainingSessions,
            sessionOrder: newSessionOrder,
            activeSessionId: newActiveSessionId,
          };
        });
      },

      updateSession: (sessionId: string, updates: Partial<WalletSession>) => {
        set((state) => {
          const session = state.sessions[sessionId];
          if (!session) {
            console.warn(`[multiWalletStore] Session not found: ${sessionId}`);
            return state;
          }

          return {
            sessions: {
              ...state.sessions,
              [sessionId]: {
                ...session,
                ...updates,
                lastActivityAt: Date.now(),
              },
            },
          };
        });
      },

      setActiveSession: (sessionId: string | null) => {
        set((state) => {
          if (sessionId && !state.sessions[sessionId]) {
            console.warn(`[multiWalletStore] Cannot set active: session not found: ${sessionId}`);
            return state;
          }

          // Update all sessions' isActive flag
          const updatedSessions: Record<string, WalletSession> = {};
          Object.entries(state.sessions).forEach(([id, session]) => {
            updatedSessions[id] = {
              ...session,
              isActive: id === sessionId,
            };
          });

          return {
            sessions: updatedSessions,
            activeSessionId: sessionId,
          };
        });
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      setError: (error: string | null) => {
        set({ error });
      },

      clearAllSessions: () => {
        set({
          sessions: {},
          sessionOrder: [],
          activeSessionId: null,
          isLoading: false,
          error: null,
        });
      },

      getSessionByAddress: (address: string) => {
        return get()._getSessionByAddress(address);
      },

      getAllSessions: () => {
        const state = get();
        return state.sessionOrder
          .map((sessionId) => state.sessions[sessionId])
          .filter((session): session is WalletSession => !!session);
      },
    }),
    {
      name: "multi-wallet-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        sessions: state.sessions,
        sessionOrder: state.sessionOrder,
        activeSessionId: state.activeSessionId,
      }),
      onRehydrateStorage: () => {
        return (state, error) => {
          if (error) {
            console.error("[multiWalletStore] Rehydration failed:", error);
          } else if (state) {
            console.log("[multiWalletStore] Rehydrated with", Object.keys(state.sessions).length, "sessions");
            // Ensure isActive is consistent after rehydration
            if (state.activeSessionId && state.sessions[state.activeSessionId]) {
              const updatedSessions: Record<string, WalletSession> = {};
              Object.entries(state.sessions).forEach(([id, session]) => {
                updatedSessions[id] = {
                  ...session,
                  isActive: id === state.activeSessionId,
                };
              });
              state.sessions = updatedSessions;
            }
          }
        };
      },
    }
  )
);

/**
 * Selectors for optimized access to multi-wallet state.
 */
export const useMultiWalletSelectors = () => {
  const sessions = useMultiWalletStore((state) => state.getAllSessions());
  const activeSession = useMultiWalletStore((state) => 
    state.activeSessionId ? state.sessions[state.activeSessionId] : null
  );
  const activeSessionId = useMultiWalletStore((state) => state.activeSessionId);
  const isLoading = useMultiWalletStore((state) => state.isLoading);
  const error = useMultiWalletStore((state) => state.error);

  return {
    sessions,
    activeSession,
    activeSessionId,
    isLoading,
    error,
    hasWallets: sessions.length > 0,
    walletCount: sessions.length,
    activeWalletAddress: activeSession?.address || null,
  };
};
