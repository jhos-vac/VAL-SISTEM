import {
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export const GOAL_KINDS = ['target_value', 'gain_percent'] as const;
export type GoalKindCode = (typeof GOAL_KINDS)[number];

export class CreateGoalDto {
  @IsString()
  @MaxLength(80)
  name: string;

  @IsIn(GOAL_KINDS)
  kind: GoalKindCode;

  // Requerido si kind = 'target_value' (en la moneda base).
  @ValidateIf((o: CreateGoalDto) => o.kind === 'target_value')
  @IsNumber()
  @Min(0.01)
  targetValue?: number;

  // Requerido si kind = 'gain_percent' (10 = +10 %).
  @ValidateIf((o: CreateGoalDto) => o.kind === 'gain_percent')
  @IsNumber()
  @Min(0.01)
  targetPercent?: number;

  @IsOptional()
  @IsISO8601()
  deadline?: string;

  // Meta de un solo activo dentro del portafolio (p.ej. "BTC +10 %").
  @IsOptional()
  @IsString()
  @MaxLength(20)
  assetSymbol?: string;
}

export class UpdateGoalDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  targetValue?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  targetPercent?: number;

  // null quita la fecha límite.
  @IsOptional()
  @IsISO8601()
  deadline?: string | null;
}
