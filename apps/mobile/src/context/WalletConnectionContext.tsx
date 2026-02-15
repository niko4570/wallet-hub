import React, {
  createContext,
  useContext,
  useCallback,
  useState,
  ReactNode,
} from "react";
import { useSolana } from "../hooks/useSolana";
import { useWalletStore } from "../store/walletStore";
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
  const walletStore = useWalletStore();

  const connectWallet = useCallback(
    async (): Promise<LinkedWallet[]> => {
      if (isConnecting) {
        throw new Error("Already connecting to wallet");
      }

      setIsConnecting(true);
      walletStore.setError(null);

      try {
        const connectedWallets = await registerPrimaryWallet();
        return connectedWallets;
      } catch (error: any) {
        console.error("Wallet connection error:", error);
        walletStore.setError(error.message || "Failed to connect wallet");
        throw error;
      } finally {
        setIsConnecting(false);
      }
    },
    [isConnecting, registerPrimaryWallet, walletStore],
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

  const disconnectAllWallets = useCallback(() => {
    walletStore.clearAllWallets();
  }, [walletStore]);

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
    error: walletStore.error,
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
