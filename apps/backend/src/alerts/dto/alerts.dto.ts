import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

// Tipos que el usuario crea a mano (los automáticos solo se prenden o
// apagan).
export const USER_ALERT_KINDS = [
  'price',
  'asset_move',
  'portfolio_move',
  'strategy_drift',
] as const;
export type UserAlertKind = (typeof USER_ALERT_KINDS)[number];

export class CreateAlertRuleDto {
  // 'price' se guarda como price_above o price_below según el precio actual.
  @IsIn(USER_ALERT_KINDS)
  kind: UserAlertKind;

  @ValidateIf(
    (o: CreateAlertRuleDto) => o.kind === 'price' || o.kind === 'asset_move',
  )
  @IsString()
  @MaxLength(20)
  assetSymbol?: string;

  // portfolio_move: sin portafolio = todos. strategy_drift: requerido.
  @ValidateIf(
    (o: CreateAlertRuleDto) =>
      o.kind === 'strategy_drift' || o.portfolioId !== undefined,
  )
  @IsUUID()
  portfolioId?: string;

  // price: precio en USDT. Movimientos y desvío: %/puntos.
  @IsNumber()
  @Min(0.00000001)
  threshold: number;

  // price: avisar cada vez que cruce (true) o una sola vez (false).
  @IsOptional()
  @IsBoolean()
  repeat?: boolean;
}

export class UpdateAlertRuleDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0.00000001)
  threshold?: number;

  @IsOptional()
  @IsBoolean()
  repeat?: boolean;
}

export class SetAutoAlertDto {
  @IsIn(['goal_events', 'dca_due'])
  kind: 'goal_events' | 'dca_due';

  @IsBoolean()
  enabled: boolean;
}

export class ListNotificationsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class MarkReadDto {
  // Sin ids: marca todas como leídas.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  ids?: string[];
}
