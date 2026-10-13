import { IsString, MinLength } from 'class-validator';

export class CloseAccountDto {
  // Se pide la contraseña para confirmar: un access token robado no alcanza
  // para borrar la cuenta.
  @IsString()
  @MinLength(1)
  password: string;
}
