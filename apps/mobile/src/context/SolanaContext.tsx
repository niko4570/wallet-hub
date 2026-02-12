import React, { createContext, useContext, ReactNode, useMemo } from "react";
import { useSolana as useSolanaHook } from "../hooks/useSolana";
import type { UseSolanaResult } from "../hooks/useSolana";
import { useWalletStore } from "../store/walletStore";

interface SolanaContextType {
  solana: UseSolanaResult;
}

const SolanaContext = createContext<SolanaContextType | undefined>(undefined);

export const SolanaProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const solana = useSolanaHook();
  const {
    linkedWallets,
    activeWallet,
    activeWalletAddress,
    balances,
    setLinkedWallets,
    setActiveWallet,
    setActiveWalletAddress,
    updateBalance,
  } = useWalletStore();

  // Sync state from useSolanaHook to walletStore
  React.useEffect(() => {
    // Always sync linked wallets, even if empty
    setLinkedWallets(solana.linkedWallets);

    // Sync active wallet
    if (solana.activeWallet) {
      setActiveWallet(solana.activeWallet);
    } else if (solana.linkedWallets.length > 0) {
      // If no active wallet but there are linked wallets, set the first one as active
      setActiveWallet(solana.linkedWallets[0]);
    }

    // Sync balances
    if (solana.balances) {
      Object.entries(solana.balances).forEach(([address, balance]) => {
        updateBalance(address, balance);
      });
    }
  }, [
    solana.linkedWallets,
    solana.activeWallet,
    solana.balances,
    setLinkedWallets,
    setActiveWallet,
    updateBalance,
  ]);

  // Create a merged solana object that uses walletStore for state
  const mergedSolana = useMemo(
    () => ({
      ...solana,
      linkedWallets,
      activeWallet,
      balances,
      isAuthenticated: linkedWallets.length > 0,
      selectActiveWallet: (address: string) => {
        // Find the wallet by address
        const wallet = linkedWallets.find((w) => w.address === address);
        if (wallet) {
          setActiveWallet(wallet);
          solana.selectActiveWallet(address);
        }
      },
    }),
    [solana, linkedWallets, activeWallet, balances, setActiveWallet],
  );

  return (
    <SolanaContext.Provider value={{ solana: mergedSolana }}>
      {children}
    </SolanaContext.Provider>
  );
};

export const useSolana = (): UseSolanaResult => {
  const context = useContext(SolanaContext);
  if (!context) {
    throw new Error("useSolana must be used within a SolanaProvider");
  }
  return context.solana;
};

// Also export the wallet store directly for components that need more control
export { useWalletStore };
