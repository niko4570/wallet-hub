import type { SessionScope } from '@wallethub/contracts';
import { IsArray, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class SessionScopeDto implements SessionScope {
  @IsString()
  name!: SessionScope['name'];

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxUsd?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  destinations?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  programs?: string[];
}
