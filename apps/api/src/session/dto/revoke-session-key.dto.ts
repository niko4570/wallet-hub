import { IsOptional, IsString } from 'class-validator';

export class RevokeSessionKeyDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
