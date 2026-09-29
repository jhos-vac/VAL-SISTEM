import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreatePortfolioDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  description?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(10)
  baseCurrency: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
