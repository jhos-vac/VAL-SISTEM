import { BadRequestException, Injectable } from '@nestjs/common';
import { UserPrismaService } from '../prisma/user-prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

export interface UserSettingsDto {
  language: string;
  currency: string;
  timezone: string;
  theme: string;
  notificationsEnabled: boolean;
  biometricEnabled: boolean;
  twoFactorEnabled: boolean;
}

export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
}

export interface CurrencyOption {
  code: string;
  symbol: string;
  name: string;
}

export interface TimezoneOption {
  name: string;
  utcOffset: string;
}

export interface SettingsCatalogsDto {
  languages: LanguageOption[];
  currencies: CurrencyOption[];
  timezones: TimezoneOption[];
}

// Valores por defecto para un usuario que todavía no guardó ningún
// ajuste — coinciden con lo que siembra prisma/seed-catalogs.ts
// (idioma español marcado isDefault, USD, UTC). No se crea ninguna fila
// en user_settings hasta el primer PATCH real (ver updateSettings).
const DEFAULTS = {
  languageCode: 'es',
  currencyCode: 'USD',
  timezoneName: 'UTC',
  theme: 'system',
} as const;

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: UserPrismaService) {}

  // Catálogo de opciones para poblar los selects de la pantalla de
  // ajustes — sembrado por npm run db:seed:catalogs (octava ronda).
  async getCatalogs(): Promise<SettingsCatalogsDto> {
    const [languages, currencies, timezones] = await Promise.all([
      this.prisma.language.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.currencie.findMany({ orderBy: { code: 'asc' } }),
      this.prisma.timezone.findMany({ orderBy: { name: 'asc' } }),
    ]);

    return {
      languages: languages.map((l) => ({
        code: l.code,
        name: l.name,
        nativeName: l.nativeName,
      })),
      currencies: currencies.map((c) => ({
        code: c.code,
        symbol: c.symbol,
        name: c.name,
      })),
      timezones: timezones.map((t) => ({ name: t.name, utcOffset: t.utcOffset })),
    };
  }

  async getSettings(userId: string): Promise<UserSettingsDto> {
    const settings = await this.prisma.userSetting.findFirst({
      where: { userId },
      include: { language: true, currencie: true, timezone: true },
    });

    if (!settings) {
      return {
        language: DEFAULTS.languageCode,
        currency: DEFAULTS.currencyCode,
        timezone: DEFAULTS.timezoneName,
        theme: DEFAULTS.theme,
        notificationsEnabled: true,
        biometricEnabled: false,
        twoFactorEnabled: false,
      };
    }

    return {
      language: settings.language.code,
      currency: settings.currencie.code,
      timezone: settings.timezone.name,
      theme: settings.theme,
      notificationsEnabled: settings.notificationsEnabled,
      biometricEnabled: settings.biometricEnabled,
      twoFactorEnabled: settings.twoFactorEnabled,
    };
  }

  // Upsert manual (UserSetting no tiene @unique en userId todavía, así
  // que no se puede usar prisma upsert directo) — cambios parciales: lo
  // que no venga en el DTO se conserva tal cual estaba (o el default, si
  // es la primera vez que el usuario guarda algo).
  async updateSettings(
    userId: string,
    dto: UpdateSettingsDto,
  ): Promise<UserSettingsDto> {
    const current = await this.getSettings(userId);

    const languageCode = dto.language ?? current.language;
    const currencyCode = dto.currency ?? current.currency;
    const timezoneName = dto.timezone ?? current.timezone;

    const [language, currencie, timezone] = await Promise.all([
      this.prisma.language.findUnique({ where: { code: languageCode } }),
      this.prisma.currencie.findUnique({ where: { code: currencyCode } }),
      this.prisma.timezone.findUnique({ where: { name: timezoneName } }),
    ]);
    if (!language) {
      throw new BadRequestException(`Idioma "${languageCode}" no existe en el catálogo`);
    }
    if (!currencie) {
      throw new BadRequestException(`Moneda "${currencyCode}" no existe en el catálogo`);
    }
    if (!timezone) {
      throw new BadRequestException(`Zona horaria "${timezoneName}" no existe en el catálogo`);
    }

    const data = {
      languageId: language.id,
      currencieId: currencie.id,
      // Nombre del campo tal como está en el schema (typo histórico:
      // "timezome", no "timezone" — ver prisma-user-database/schema.prisma).
      timezomeId: timezone.id,
      theme: dto.theme ?? current.theme,
      notificationsEnabled: dto.notificationsEnabled ?? current.notificationsEnabled,
      biometricEnabled: dto.biometricEnabled ?? current.biometricEnabled,
      twoFactorEnabled: dto.twoFactorEnabled ?? current.twoFactorEnabled,
    };

    const existing = await this.prisma.userSetting.findFirst({ where: { userId } });
    const saved = existing
      ? await this.prisma.userSetting.update({ where: { id: existing.id }, data })
      : await this.prisma.userSetting.create({ data: { userId, ...data } });

    return {
      language: languageCode,
      currency: currencyCode,
      timezone: timezoneName,
      theme: saved.theme,
      notificationsEnabled: saved.notificationsEnabled,
      biometricEnabled: saved.biometricEnabled,
      twoFactorEnabled: saved.twoFactorEnabled,
    };
  }
}
