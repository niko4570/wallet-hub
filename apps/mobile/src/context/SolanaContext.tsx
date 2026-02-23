import React, { createContext, useContext, ReactNode } from "react";
import { useSolanaStore } from "../store/solanaStore";
import type { UseSolanaResult } from "../hooks/useSolana";

interface SolanaContextType {
  solana: UseSolanaResult;
}

const SolanaContext = createContext<SolanaContextType | undefined>(undefined);

export const SolanaProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const {
    linkedWallets,
    activeWallet,
    activeWalletAddress,
    isAuthenticated,
    balances,
    detailedBalances,
    disconnect,
    sendSol,
    registerPrimaryWallet,
    selectActiveWallet,
    refreshBalance,
    startAuthorization,
    finalizeAuthorization,
    silentRefreshAuthorization,
    connection,
  } = useSolanaStore();

  // Create solana object from the store
  const solana: UseSolanaResult = {
    disconnect,
    sendSol,
    registerPrimaryWallet,
    linkedWallets,
    activeWallet,
    selectActiveWallet,
    connection,
    isAuthenticated,
    balances,
    detailedBalances,
    refreshBalance,
    startAuthorization,
    finalizeAuthorization,
    silentRefreshAuthorization,
  };

  return (
    <SolanaContext.Provider value={{ solana }}>
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

// Export the solana store directly for components that need more control
export { useSolanaStore };