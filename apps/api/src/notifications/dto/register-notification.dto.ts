import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class RegisterNotificationDto {
  @IsString()
  @Length(10, 200)
  token!: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayUnique()
  @ArrayMaxSize(32)
  @IsOptional()
  addresses?: string[];
}
