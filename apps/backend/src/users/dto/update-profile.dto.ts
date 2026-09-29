import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

// Perfil básico únicamente (firstName/lastName/username) — el
// sub-recurso de settings (idioma/moneda/tema/zona horaria) queda para
// cuando el frontend conecte la pantalla de ajustes, ver
// UpdateSettingsDto en el mismo módulo.
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  username?: string;
}
