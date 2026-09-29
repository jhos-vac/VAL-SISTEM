// Siembra los catálogos de idioma/moneda/zona horaria del dominio
// Identity (UserSetting depende de los 3) — hasta ahora nada los
// poblaba, así que PATCH /users/me con settings completos no se podía
// implementar sin hardcodear valores (ver Estado_Backend_VAL-BACKEND.md,
// sección "Pendiente"). Idempotente: los 3 modelos tienen un campo
// @unique (code/code/name) así que se puede usar upsert de verdad, a
// diferencia de Role/Permission (ver seed-user.ts).
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient as UserPrismaClient } from './generated/user-cli/client';

const LANGUAGES = [
  { code: 'es', name: 'Español', nativeName: 'Español', isDefault: true },
  { code: 'en', name: 'Inglés', nativeName: 'English', isDefault: false },
];

const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'Dólar estadounidense', decimals: 2 },
  { code: 'EUR', symbol: '€', name: 'Euro', decimals: 2 },
  { code: 'ARS', symbol: '$', name: 'Peso argentino', decimals: 2 },
  { code: 'MXN', symbol: '$', name: 'Peso mexicano', decimals: 2 },
  { code: 'VES', symbol: 'Bs.', name: 'Bolívar venezolano', decimals: 2 },
];

const TIMEZONES = [
  { name: 'UTC', utcOffset: '+00:00' },
  { name: 'America/Caracas', utcOffset: '-04:00' },
  { name: 'America/Bogota', utcOffset: '-05:00' },
  { name: 'America/Mexico_City', utcOffset: '-06:00' },
  { name: 'America/Argentina/Buenos_Aires', utcOffset: '-03:00' },
  { name: 'Europe/Madrid', utcOffset: '+01:00' },
];

async function main() {
  const userPrisma = new UserPrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_USER! }),
  });

  try {
    for (const lang of LANGUAGES) {
      await userPrisma.language.upsert({
        where: { code: lang.code },
        create: lang,
        update: lang,
      });
    }
    console.log(`Idiomas sembrados: ${LANGUAGES.length}`);

    for (const currency of CURRENCIES) {
      await userPrisma.currencie.upsert({
        where: { code: currency.code },
        create: currency,
        update: currency,
      });
    }
    console.log(`Monedas sembradas: ${CURRENCIES.length}`);

    for (const tz of TIMEZONES) {
      await userPrisma.timezone.upsert({
        where: { name: tz.name },
        create: tz,
        update: tz,
      });
    }
    console.log(`Zonas horarias sembradas: ${TIMEZONES.length}`);
  } finally {
    await userPrisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Error al sembrar catálogos:', err);
  process.exit(1);
});
