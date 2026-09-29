import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateWalletDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  walletName: string;

  // Libre a propósito para el MVP: 'manual', 'binance_spot', 'on_chain', etc.
  // No hay todavía un catálogo/enum real de tipos de wallet en el schema.
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  walletType: string;

  // Dirección on-chain real, si aplica. Si no se manda (wallet manual/de
  // exchange sin address real), el servicio genera un placeholder único
  // (la columna `address` es @unique en todo el dominio Portfolio).
  @IsOptional()
  @IsString()
  @MaxLength(120)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  network?: string;
}
