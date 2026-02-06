import type { IssueSessionKeyPayload } from '@wallethub/contracts';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { SessionScopeDto } from './session-scope.dto';

export class IssueSessionKeyDto implements IssueSessionKeyPayload {
  @IsString()
  @Length(32, 64)
  walletAddress!: string;

  @IsString()
  devicePublicKey!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SessionScopeDto)
  scopes!: SessionScopeDto[];

  @IsInt()
  @Min(5)
  @Max(7 * 24 * 60)
  expiresInMinutes!: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, string>;
}
