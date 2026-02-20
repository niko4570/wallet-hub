import React, {
  createContext,
  useContext,
  useCallback,
  useState,
  ReactNode,
} from "react";
import { useSolana } from "./SolanaContext";
import { useWalletStatusStore, useWalletBaseStore } from "../navigation/walletStore";
import { LinkedWallet } from "../types/wallet";

interface WalletConnectionContextType {
  isConnecting: boolean;
  isConnected: boolean;
  connectedWallets: LinkedWallet[];
  activeWallet: LinkedWallet | null;
  error: string | null;
  connectWallet: () => Promise<LinkedWallet[]>;
  disconnectWallet: (address?: string) => Promise<void>;
  disconnectAllWallets: () => void;
  switchWallet: (address: string) => void;
}

const WalletConnectionContext = createContext<
  WalletConnectionContextType | undefined
>(undefined);

export const useWalletConnection = () => {
  const context = useContext(WalletConnectionContext);
  if (!context) {
    throw new Error(
      "useWalletConnection must be used within a WalletConnectionProvider",
    );
  }
  return context;
};

interface WalletConnectionProviderProps {
  children: ReactNode;
}

export const WalletConnectionProvider: React.FC<
  WalletConnectionProviderProps
> = ({ children }) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const {
    linkedWallets,
    activeWallet,
    registerPrimaryWallet,
    disconnect,
    selectActiveWallet,
  } = useSolana();
  const walletStatusStore = useWalletStatusStore();

  const connectWallet = useCallback(
    async (): Promise<LinkedWallet[]> => {
      if (isConnecting) {
        throw new Error("Already connecting to wallet");
      }

      setIsConnecting(true);
      walletStatusStore.setError(null);

      try {
        const connectedWallets = await registerPrimaryWallet();
        return connectedWallets;
      } catch (error: any) {
        console.error("Wallet connection error:", error);
        walletStatusStore.setError(error.message || "Failed to connect wallet");
        throw error;
      } finally {
        setIsConnecting(false);
      }
    },
    [isConnecting, registerPrimaryWallet, walletStatusStore],
  );

  const disconnectWallet = useCallback(
    async (address?: string) => {
      try {
        await disconnect(address);
      } catch (error) {
        console.error("Wallet disconnection error:", error);
        throw error;
      }
    },
    [disconnect],
  );

  const walletBaseStore = useWalletBaseStore();
  
  const disconnectAllWallets = useCallback(() => {
    walletBaseStore.clearAllWallets();
  }, [walletBaseStore]);

  const switchWallet = useCallback(
    (address: string) => {
      selectActiveWallet(address);
    },
    [selectActiveWallet],
  );

  const value: WalletConnectionContextType = {
    isConnecting,
    isConnected: linkedWallets.length > 0,
    connectedWallets: linkedWallets,
    activeWallet,
    error: walletStatusStore.error,
    connectWallet,
    disconnectWallet,
    disconnectAllWallets,
    switchWallet,
  };

  return (
    <WalletConnectionContext.Provider value={value}>
      {children}
    </WalletConnectionContext.Provider>
  );
};
