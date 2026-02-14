// Import existing services
import { priceService } from "./priceService";
import { authorizationApi } from "./authorizationService";
import { iconService } from "./iconService";
import { walletService } from "./walletService";
import { heliusService } from "./heliusService";

// Import new services
import { walletAdapterService } from "./walletAdapterService";
import { rpcService } from "./rpcService";
import { SecureStorageService } from "./secureStorageService";
import { jupiterService } from "./jupiterService";

// Service registry interface
interface ServiceRegistry {
  price: typeof priceService;
  authorization: typeof authorizationApi;
  icon: typeof iconService;
  wallet: typeof walletService;
  walletAdapter: typeof walletAdapterService;
  rpc: typeof rpcService;
  helius: typeof heliusService;
  secureStorage: typeof SecureStorageService;
  jupiter: typeof jupiterService;
}

// Create service registry
export const services: ServiceRegistry = {
  price: priceService,
  authorization: authorizationApi,
  icon: iconService,
  wallet: walletService,
  walletAdapter: walletAdapterService,
  rpc: rpcService,
  helius: heliusService,
  secureStorage: SecureStorageService,
  jupiter: jupiterService,
};

// Export services individually for convenience
export {
  priceService,
  authorizationApi,
  iconService,
  walletService,
  walletAdapterService,
  rpcService,
  heliusService,
  SecureStorageService,
  jupiterService,
};

// Export service types
export type { ServiceRegistry };
