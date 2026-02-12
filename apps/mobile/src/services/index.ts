// Import existing services
import { priceService } from "./priceService";
import { telemetryService } from "./telemetryService";
import { authorizationApi } from "./authorizationService";
import { iconService } from "./iconService";
import { walletService } from "./walletService";
import { heliusService } from "./heliusService";

// Import new services
import { walletAdapterService } from "./walletAdapterService";
import { rpcService } from "./rpcService";
import { SecureStorageService } from "./secureStorageService";

// Service registry interface
interface ServiceRegistry {
  price: typeof priceService;
  telemetry: typeof telemetryService;
  authorization: typeof authorizationApi;
  icon: typeof iconService;
  wallet: typeof walletService;
  walletAdapter: typeof walletAdapterService;
  rpc: typeof rpcService;
  helius: typeof heliusService;
  secureStorage: typeof SecureStorageService;
}

// Create service registry
export const services: ServiceRegistry = {
  price: priceService,
  telemetry: telemetryService,
  authorization: authorizationApi,
  icon: iconService,
  wallet: walletService,
  walletAdapter: walletAdapterService,
  rpc: rpcService,
  helius: heliusService,
  secureStorage: SecureStorageService,
};

// Export services individually for convenience
export {
  priceService,
  telemetryService,
  authorizationApi,
  iconService,
  walletService,
  walletAdapterService,
  rpcService,
  heliusService,
  SecureStorageService,
};

// Export service types
export type { ServiceRegistry };
