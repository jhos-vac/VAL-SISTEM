import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class TargetAllocationItemDto {
  @IsString()
  @MaxLength(20)
  assetSymbol: string;

  @IsNumber()
  @Min(0.01)
  @Max(100)
  targetPercent: number;
}

export class SetTargetAllocationDto {
  // Reemplaza la asignación completa; vacía = sin asignación objetivo.
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => TargetAllocationItemDto)
  items: TargetAllocationItemDto[];
}

export const DCA_FREQUENCIES = ['weekly', 'biweekly', 'monthly'] as const;

export class CreateDcaPlanDto {
  @IsString()
  @MaxLength(20)
  assetSymbol: string;

  // Monto por compra, en la moneda base del portafolio.
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsIn(DCA_FREQUENCIES)
  frequency: (typeof DCA_FREQUENCIES)[number];

  @IsISO8601()
  startDate: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;
}

export class UpdateDcaPlanDto {
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // null quita la fecha de fin.
  @IsOptional()
  @IsISO8601()
  endDate?: string | null;
}
