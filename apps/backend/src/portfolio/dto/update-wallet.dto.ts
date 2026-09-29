import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateWalletDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  walletName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  walletType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  network?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
