import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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

@Injectable()
export class InfrastructureConfigService {
  constructor(private readonly configService: ConfigService) {}

  get databaseUrl(): string {
    return this.configService.get<string>('database.url')!;
  }

  get solanaRpcUrl(): string {
    return this.configService.get<string>('solana.rpcUrl')!;
  }

  get priorityRpcUrl(): string {
    return (
      this.configService.get<string>('solana.priorityRpcUrl') ||
      this.solanaRpcUrl
    );
  }

  get heliusApiKey(): string | undefined {
    return this.configService.get<string>('helius.apiKey');
  }

  get sessionKeysEnabled(): boolean {
    return this.configService.get<boolean>('session.enabled')!;
  }

  describe(): InfrastructureDescriptor {
    return {
      database: this.describeDatabase(),
      solanaRpc: this.describeEndpoint(this.solanaRpcUrl),
      priorityRpc: this.describeEndpoint(this.priorityRpcUrl),
    };
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
