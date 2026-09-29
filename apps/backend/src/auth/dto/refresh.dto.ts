import { IsOptional, IsString } from 'class-validator';

// El refresh token normalmente viaja en la cookie httpOnly (web, RNFC-01).
// Este campo es el fallback para clientes que no manejan cookies (móvil).
export class RefreshDto {
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
