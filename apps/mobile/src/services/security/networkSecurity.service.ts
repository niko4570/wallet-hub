export class NetworkSecurityService {
  private static instance: NetworkSecurityService;
  private allowedDomains: Set<string> = new Set();
  private blockedDomains: Set<string> = new Set();

  private constructor() {
    this.initializeDefaultDomains();
  }

  static getInstance(): NetworkSecurityService {
    if (!NetworkSecurityService.instance) {
      NetworkSecurityService.instance = new NetworkSecurityService();
    }
    return NetworkSecurityService.instance;
  }

  private initializeDefaultDomains(): void {
    const defaultAllowedDomains = [
      'api.helius.xyz',
      'mainnet.helius-rpc.com',
      'devnet.helius-rpc.com',
      'testnet.helius-rpc.com',
      'api.jup.ag',
      'api.coingecko.com',
      'api.mainnet-beta.solana.com',
      'api.devnet.solana.com',
      'api.testnet.solana.com',
    ];

    defaultAllowedDomains.forEach(domain => {
      this.allowedDomains.add(domain);
    });
  }

  private isLocalhost(hostname: string): boolean {
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "10.0.2.2"
    );
  }

  private isPrivateIp(hostname: string): boolean {
    const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!match) {
      return false;
    }
    const parts = match.slice(1).map((value) => Number(value));
    if (parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
      return false;
    }
    const [a, b] = parts;
    if (a === 10) {
      return true;
    }
    if (a === 172 && b >= 16 && b <= 31) {
      return true;
    }
    if (a === 192 && b === 168) {
      return true;
    }
    return false;
  }

  private isDevEnvironment(): boolean {
    return process.env?.NODE_ENV !== "production";
  }

  isUrlSecure(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol === "https:") {
        return true;
      }
      return (
        parsedUrl.protocol === "http:" &&
        (this.isLocalhost(parsedUrl.hostname) ||
          (this.isDevEnvironment() && this.isPrivateIp(parsedUrl.hostname)))
      );
    } catch {
      return false;
    }
  }

  validateUrl(url: string): { valid: boolean; error?: string } {
    try {
      const parsedUrl = new URL(url);

      if (
        parsedUrl.protocol !== "https:" &&
        !(
          parsedUrl.protocol === "http:" &&
          (this.isLocalhost(parsedUrl.hostname) ||
            (this.isDevEnvironment() &&
              this.isPrivateIp(parsedUrl.hostname)))
        )
      ) {
        return {
          valid: false,
          error: 'URL must use HTTPS protocol',
        };
      }

      const hostname = parsedUrl.hostname;
      if (this.blockedDomains.has(hostname)) {
        return {
          valid: false,
          error: `Domain ${hostname} is blocked`,
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: `Invalid URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  addAllowedDomain(domain: string): void {
    this.allowedDomains.add(domain);
  }

  removeAllowedDomain(domain: string): void {
    this.allowedDomains.delete(domain);
  }

  addBlockedDomain(domain: string): void {
    this.blockedDomains.add(domain);
  }

  removeBlockedDomain(domain: string): void {
    this.blockedDomains.delete(domain);
  }

  getAllowedDomains(): string[] {
    return Array.from(this.allowedDomains);
  }

  getBlockedDomains(): string[] {
    return Array.from(this.blockedDomains);
  }

  async secureFetch(url: string, options?: RequestInit): Promise<Response> {
    const validation = this.validateUrl(url);
    if (!validation.valid) {
      throw new Error(validation.error || 'URL validation failed');
    }

    return fetch(url, options);
  }

  createSecureFetchInterceptor(): (
    url: string,
    options?: RequestInit,
  ) => Promise<Response> {
    return async (url: string, options?: RequestInit) => {
      return this.secureFetch(url, options);
    };
  }

  validateEnvironmentVariables(): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    const envVars = [
      'EXPO_PUBLIC_API_URL',
      'EXPO_PUBLIC_HELIUS_API_BASE',
      'EXPO_PUBLIC_HELIUS_RPC_URL',
      'EXPO_PUBLIC_SOLANA_RPC_URL',
    ];

    envVars.forEach(varName => {
      const value = process.env?.[varName];
      if (value) {
        const validation = this.validateUrl(value);
        if (!validation.valid) {
          errors.push(`${varName}: ${validation.error}`);
        }
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export const networkSecurityService = NetworkSecurityService.getInstance();
