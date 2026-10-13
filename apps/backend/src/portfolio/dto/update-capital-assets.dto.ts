import { ArrayMaxSize, IsArray, IsString, MaxLength } from 'class-validator';

export class UpdateCapitalAssetsDto {
  // Lista completa (reemplaza la anterior); vacía = ninguna moneda capital.
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(20, { each: true })
  symbols: string[];
}
