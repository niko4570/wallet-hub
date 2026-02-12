import { Injectable } from '@nestjs/common';

export interface EndpointDescriptor {
  host: string;
  protocol: string;
  usesHttps: boolean;
}

export interface DatabaseDescriptor {
  vendor: string;
  host?: string;
  configured: boolean;
  managed: boolean;
}

export interface InfrastructureDescriptor {
  database: DatabaseDescriptor;
  solanaRpc: EndpointDescriptor;
  priorityRpc: EndpointDescriptor;
}

const LOCAL_DATABASE_FALLBACK =
  'postgresql://postgres:postgres@localhost:5432/wallethub';

@Injectable()
export class InfrastructureConfigService {
  readonly databaseUrl: string;
  readonly solanaRpcUrl: string;
  readonly priorityRpcUrl: string;
  readonly heliusApiKey?: string;

  constructor() {
    const dbEnv = process.env.DATABASE_URL?.trim();
    this.databaseUrl =
      dbEnv && dbEnv.length > 0 ? dbEnv : LOCAL_DATABASE_FALLBACK;

    const heliusKey = process.env.HELIUS_API_KEY?.trim();
    this.heliusApiKey =
      heliusKey && heliusKey.length > 0 ? heliusKey : undefined;

    const rpcOverride = process.env.SOLANA_RPC_URL?.trim();
    this.solanaRpcUrl =
      rpcOverride && rpcOverride.length > 0
        ? rpcOverride
        : this.buildHeliusRpcUrl();

    const priorityOverride = process.env.SOLANA_PRIORITY_RPC_URL?.trim();
    this.priorityRpcUrl =
      priorityOverride && priorityOverride.length > 0
        ? priorityOverride
        : this.solanaRpcUrl;
  }

  describe(): InfrastructureDescriptor {
    return {
      database: this.describeDatabase(),
      solanaRpc: this.describeEndpoint(this.solanaRpcUrl),
      priorityRpc: this.describeEndpoint(this.priorityRpcUrl),
    };
  }

  private buildHeliusRpcUrl(): string {
    if (this.heliusApiKey) {
      return `https://mainnet.helius-rpc.com/?api-key=${this.heliusApiKey}`;
    }
    return 'https://api.mainnet-beta.solana.com';
  }

  private describeDatabase(): DatabaseDescriptor {
    const vendor = this.databaseUrl.startsWith('postgres')
      ? 'postgresql'
      : 'custom';
    try {
      const parsed = new URL(this.databaseUrl);
      const isLocal =
        parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
      return {
        vendor,
        host: parsed.host,
        configured: true,
        managed: !isLocal,
      };
    } catch {
      return {
        vendor,
        configured: Boolean(this.databaseUrl),
        managed:
          Boolean(this.databaseUrl) &&
          !this.databaseUrl.includes('localhost') &&
          !this.databaseUrl.includes('127.0.0.1'),
      };
    }
  }

  private describeEndpoint(endpoint: string): EndpointDescriptor {
    try {
      const parsed = new URL(endpoint);
      return {
        host: parsed.host,
        protocol: parsed.protocol.replace(':', ''),
        usesHttps: parsed.protocol === 'https:',
      };
    } catch {
      const usesHttps = endpoint.startsWith('https://');
      return {
        host: endpoint,
        protocol: usesHttps ? 'https' : 'custom',
        usesHttps,
      };
    }
  }
}
