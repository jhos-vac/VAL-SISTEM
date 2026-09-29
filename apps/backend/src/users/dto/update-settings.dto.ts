import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

const THEMES = ['system', 'light', 'dark'] as const;

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  language?: string; // code, ver GET /users/settings/catalogs

  @IsOptional()
  @IsString()
  currency?: string; // code

  @IsOptional()
  @IsString()
  timezone?: string; // name (p.ej. "America/Caracas")

  @IsOptional()
  @IsIn(THEMES)
  theme?: (typeof THEMES)[number];

  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  biometricEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  twoFactorEnabled?: boolean;
}
