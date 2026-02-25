// Import existing services
import { authorizationApi } from "./api/authorizationService";
import { heliusService } from "./api/heliusService";
import { jupiterPortfolioService } from "./api/jupiterPortfolioService";
import { jupiterService } from "./api/jupiterService";
import { notificationService } from "./api/notificationService";
import { priceService } from "./api/priceService";
import { tokenMetadataService } from "./api/tokenMetadataService";
import { rpcService } from "./solana/rpcService";
import * as solanaProvider from "./solana/solanaProvider";
import { SecureStorageService } from "./storage/secureStorage.service";
import * as assetService from "./wallet/assetService";
import { walletAdapterService } from "./wallet/walletAdapterService";
import { walletService } from "./wallet/walletService";

// Service registry interface
interface ServiceRegistry {
  authorization: typeof authorizationApi;
  helius: typeof heliusService;
  jupiter: typeof jupiterService;
  jupiterPortfolio: typeof jupiterPortfolioService;
  notification: typeof notificationService;
  price: typeof priceService;
  tokenMetadata: typeof tokenMetadataService;
  rpc: typeof rpcService;
  solanaProvider: typeof solanaProvider;
  asset: typeof assetService;
  secureStorage: typeof SecureStorageService;
  wallet: typeof walletService;
  walletAdapter: typeof walletAdapterService;
}

// Create service registry
export const services: ServiceRegistry = {
  authorization: authorizationApi,
  helius: heliusService,
  jupiter: jupiterService,
  jupiterPortfolio: jupiterPortfolioService,
  notification: notificationService,
  price: priceService,
  tokenMetadata: tokenMetadataService,
  rpc: rpcService,
  solanaProvider: solanaProvider,
  asset: assetService,
  secureStorage: SecureStorageService,
  wallet: walletService,
  walletAdapter: walletAdapterService,
};

// Export services individually for convenience
export {
  authorizationApi,
  heliusService,
  jupiterPortfolioService,
  jupiterService,
  notificationService,
  priceService,
  tokenMetadataService,
  rpcService,
  solanaProvider,
  assetService,
  SecureStorageService,
  walletService,
  walletAdapterService,
};

export { fetchAssets } from "./wallet/assetService";
export { fetchSolanaAssets } from "./solana/solanaProvider";
export * from "./api/watchlistDataService";

// Export service types
export type { ServiceRegistry };
