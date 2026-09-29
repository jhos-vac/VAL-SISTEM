import {
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export const TRANSACTION_TYPE_CODES = [
  'buy',
  'sell',
  'transfer_in',
  'transfer_out',
] as const;
export type TransactionTypeCode = (typeof TRANSACTION_TYPE_CODES)[number];

export class CreateTransactionDto {
  @IsUUID()
  walletId: string;

  @IsString()
  assetSymbol: string;

  @IsIn(TRANSACTION_TYPE_CODES)
  type: TransactionTypeCode;

  @IsNumber({ maxDecimalPlaces: 12 })
  @Min(0.000000000001)
  quantity: number;

  @IsNumber({ maxDecimalPlaces: 12 })
  @Min(0)
  price: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 12 })
  @Min(0)
  fee?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsISO8601()
  executedAt: string;
}
