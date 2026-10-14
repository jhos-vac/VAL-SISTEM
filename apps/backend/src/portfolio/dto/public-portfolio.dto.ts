import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class SetPublicationDto {
  @IsBoolean()
  isPublic: boolean;

  // Nombre con el que aparece en el ranking (requerido al publicar). Nunca
  // se muestra el usuario ni el email del dueño.
  @ValidateIf((o: SetPublicationDto) => o.isPublic)
  @IsString()
  @MinLength(3)
  @MaxLength(40)
  alias?: string;
}

export class CopyPortfolioDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(10)
  baseCurrency?: string;
}
