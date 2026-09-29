import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

// MVP solo soporta Binance (no hay campo `exchange` — se asume binance).
// `apiKey`/`apiSecret` se validan contra Binance de verdad antes de
// guardarse (ver exchange.service.ts), esto acá es solo un chequeo de
// forma para no aceptar campos vacíos o claramente incompletos.
export class ConnectExchangeAccountDto {
  @IsString()
  @MinLength(3)
  @MaxLength(60)
  label: string;

  @IsString()
  @MinLength(10)
  apiKey: string;

  @IsString()
  @MinLength(10)
  apiSecret: string;

  @IsOptional()
  @IsBoolean()
  isTestnet?: boolean;
}
