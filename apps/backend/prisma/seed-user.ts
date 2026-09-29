// Seed inicial del dominio Identity: roles base (admin/user), un permiso
// de ejemplo ligado a una acción que ya puede restringirse (sync manual
// de tickers), y dos usuarios de prueba (uno normal, uno administrador)
// para poder probar la app de inmediato sin registrarse a mano cada vez
// que se resetea la base.
//
// Correr con: npm run db:seed:user (requiere DATABASE_USER en .env y la
// base ya migrada — npm run db:migrate:user).
//
// Role/Permission no tienen un campo @unique más allá de `id` en el
// schema, así que en vez de upsert se usa "buscar por nombre, crear si
// no existe" — sigue siendo idempotente (no duplica en corridas
// repetidas), solo que con otra sintaxis que los demás seeds.
import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/user-cli/client';

const connectionString = process.env.DATABASE_USER;
if (!connectionString) {
  throw new Error('Falta DATABASE_USER en el .env del backend');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const BCRYPT_SALT_ROUNDS = 12;

// Credenciales de desarrollo/pruebas — no son secretos reales, están
// pensadas para poder loguearse de inmediato en un entorno local recién
// levantado. No usar estos valores en producción.
const TEST_USER = {
  firstName: 'Usuario',
  lastName: 'Prueba',
  username: 'usuario_test',
  email: 'test@valsistem.dev',
  password: 'Test1234!',
};

const ADMIN_USER = {
  firstName: 'Admin',
  lastName: 'VAL-SISTEM',
  username: 'admin',
  email: 'admin@valsistem.dev',
  password: 'Admin1234!',
};

async function findOrCreateRole(name: string, description: string) {
  const existing = await prisma.role.findFirst({ where: { name } });
  if (existing) return existing;
  return prisma.role.create({ data: { name, description } });
}

async function findOrCreatePermission(
  name: string,
  description: string,
  module: string,
) {
  const existing = await prisma.permission.findFirst({
    where: { name, module },
  });
  if (existing) return existing;
  return prisma.permission.create({ data: { name, description, module } });
}

async function upsertSeedUser(
  u: {
    firstName: string;
    lastName: string;
    username: string;
    email: string;
    password: string;
  },
  roleId: string,
) {
  const passwordHash = await bcrypt.hash(u.password, BCRYPT_SALT_ROUNDS);
  const user = await prisma.user.upsert({
    where: { email: u.email },
    create: {
      firstName: u.firstName,
      lastName: u.lastName,
      username: u.username,
      email: u.email,
      passwordHash,
      emailVerified: true,
      status: 'Active',
    },
    update: {
      // No se pisa la contraseña de un usuario ya existente en corridas
      // repetidas (podría estar en uso en una sesión de pruebas activa)
      // — solo se asegura que el perfil básico y el estado queden bien.
      firstName: u.firstName,
      lastName: u.lastName,
      status: 'Active',
    },
  });

  await prisma.userRole.upsert({
    where: { roleId_userId: { roleId, userId: user.id } },
    create: { roleId, userId: user.id },
    update: {},
  });

  return user;
}

async function main() {
  console.log('Seed Identity: roles...');
  const adminRole = await findOrCreateRole(
    'admin',
    'Acceso total a la plataforma, incluye endpoints administrativos.',
  );
  const userRole = await findOrCreateRole(
    'user',
    'Usuario estándar — acceso a sus propios portafolios y datos de mercado.',
  );

  console.log('Seed Identity: permisos...');
  const syncPermission = await findOrCreatePermission(
    'market:sync-tickers',
    'Disparar manualmente la sincronización de precios de Binance.',
    'market',
  );
  await prisma.rolePermission.upsert({
    where: {
      roleId_permissionsId: {
        roleId: adminRole.id,
        permissionsId: syncPermission.id,
      },
    },
    create: { roleId: adminRole.id, permissionsId: syncPermission.id },
    update: {},
  });

  console.log('Seed Identity: usuarios de prueba...');
  const testUser = await upsertSeedUser(TEST_USER, userRole.id);
  const adminUser = await upsertSeedUser(ADMIN_USER, adminRole.id);

  console.log('Seed Identity completo.');
  console.log(
    `  Usuario de prueba -> ${TEST_USER.email} / ${TEST_USER.password} (id: ${testUser.id})`,
  );
  console.log(
    `  Administrador     -> ${ADMIN_USER.email} / ${ADMIN_USER.password} (id: ${adminUser.id})`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
