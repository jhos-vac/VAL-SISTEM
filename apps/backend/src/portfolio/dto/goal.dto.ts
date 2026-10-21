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

export const GOAL_KINDS = [
  'target_value',
  'gain_percent',
  'asset_quantity',
  'target_price',
] as const;
export type GoalKindCode = (typeof GOAL_KINDS)[number];

// Tipos que siempre son de un activo.
export const ASSET_GOAL_KINDS: readonly GoalKindCode[] = [
  'asset_quantity',
  'target_price',
];

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

  // Requerido si kind = 'asset_quantity' (p.ej. 0.5 BTC).
  @ValidateIf((o: CreateGoalDto) => o.kind === 'asset_quantity')
  @IsNumber()
  @Min(0.00000001)
  targetQuantity?: number;

  // Requerido si kind = 'target_price' (precio por unidad en USDT).
  @ValidateIf((o: CreateGoalDto) => o.kind === 'target_price')
  @IsNumber()
  @Min(0.00000001)
  targetPrice?: number;

  @IsOptional()
  @IsISO8601()
  deadline?: string;

  // Meta de un solo activo (requerido en asset_quantity y target_price).
  @ValidateIf(
    (o: CreateGoalDto) =>
      ASSET_GOAL_KINDS.includes(o.kind) || o.assetSymbol !== undefined,
  )
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

  @IsOptional()
  @IsNumber()
  @Min(0.00000001)
  targetQuantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.00000001)
  targetPrice?: number;

  // null quita la fecha límite.
  @IsOptional()
  @IsISO8601()
  deadline?: string | null;
}
