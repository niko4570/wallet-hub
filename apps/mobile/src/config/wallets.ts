import { WalletCatalogEntry } from "../types/wallet";

export const WALLET_DIRECTORY: WalletCatalogEntry[] = [
  {
    id: "phantom",
    name: "Phantom",
    icon: "",
    scheme: "phantom://",
    baseUri: "https://phantom.app/ul/v1/wallet/adapter",
    subtitle: "Fast, secure & popular",
  },
  {
    id: "solflare",
    name: "Solflare",
    icon: "",
    scheme: "solflare://",
    baseUri: "https://solflare.com/ul/v1/wallet/adapter",
    subtitle: "DeFi focused wallet",
  },
  {
    id: "backpack",
    name: "Backpack",
    icon: "",
    scheme: "backpack://",
    baseUri: "https://backpack.app/ul/v1/wallet/adapter",
    subtitle: "xNFT capable",
  },
  {
    id: "glow",
    name: "Glow",
    icon: "",
    scheme: "glow://",
    baseUri: "https://glow.app/ul/v1/wallet/adapter",
    subtitle: "Simple & social",
  },
  {
    id: "tiplink",
    name: "TipLink",
    icon: "",
    scheme: "tiplink://",
    baseUri: "https://tiplink.io/ul/v1/wallet/adapter",
    subtitle: "Link-based wallet",
  },
  {
    id: "safepal",
    name: "SafePal",
    icon: "",
    scheme: "safepal://",
    baseUri: "https://safepal.io/ul/v1/wallet/adapter",
    subtitle: "Secure & user-friendly",
  },
  {
    id: "trust",
    name: "Trust Wallet",
    icon: "",
    scheme: "trust://",
    baseUri: "https://trustwallet.com/ul/v1/wallet/adapter",
    subtitle: "Multi-chain support",
  },
];

export const getWalletById = (id: string): WalletCatalogEntry | undefined => {
  return WALLET_DIRECTORY.find((wallet) => wallet.id === id);
};

export const getInstalledWallets = async (): Promise<WalletCatalogEntry[]> => {
  // This will be implemented with Linking.canOpenURL checks
  // For now, return all wallets
  return WALLET_DIRECTORY;
};
