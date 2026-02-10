import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class CapabilityReportDto {
  @IsBoolean()
  supportsCloneAuthorization!: boolean;

  @IsBoolean()
  supportsSignAndSendTransactions!: boolean;

  @IsBoolean()
  supportsSignTransactions!: boolean;

  @IsBoolean()
  supportsSignMessages!: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  supportedTransactionVersions?: string[];

  @IsOptional()
  @IsNumber()
  maxTransactionsPerRequest?: number;

  @IsOptional()
  @IsNumber()
  maxMessagesPerRequest?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  featureFlags?: string[];
}

export class RecordSilentReauthorizationDto {
  @IsString()
  walletAddress!: string;

  @IsOptional()
  @IsString()
  walletAppId?: string;

  @IsOptional()
  @IsString()
  walletName?: string;

  @IsOptional()
  @IsString()
  authToken?: string;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;

  @IsString()
  @IsIn(['silent', 'prompted'])
  method!: 'silent' | 'prompted';

  @ValidateNested()
  @Type(() => CapabilityReportDto)
  capabilities!: CapabilityReportDto;

  @IsOptional()
  @IsString()
  error?: string;
}
