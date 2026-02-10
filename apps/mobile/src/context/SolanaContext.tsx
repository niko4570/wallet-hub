import React, { createContext, useContext, ReactNode } from "react";
import { useSolana as useSolanaHook } from "../hooks/useSolana";
import type { UseSolanaResult } from "../hooks/useSolana";

interface SolanaContextType {
  solana: UseSolanaResult;
}

const SolanaContext = createContext<SolanaContextType | undefined>(undefined);

export const SolanaProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const solana = useSolanaHook();

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
