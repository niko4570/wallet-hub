import type { WalletProvider } from '@wallethub/contracts';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';

const WALLET_PROVIDERS = {
  phantom: 'phantom',
  solflare: 'solflare',
  backpack: 'backpack',
  ledger: 'ledger',
  'mobile-stack': 'mobile-stack',
  custom: 'custom',
} as const satisfies Record<WalletProvider, WalletProvider>;

export class LinkWalletDto {
  @IsString()
  @Length(32, 64)
  address!: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsEnum(WALLET_PROVIDERS, {
    message: 'provider must be a supported wallet connector',
  })
  provider!: WalletProvider;
}
