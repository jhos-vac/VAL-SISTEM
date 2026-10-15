// Tareas de administración que no tienen pantalla (o que hacen falta antes
// de que exista un admin para usarla).
//
//   npm run admin -- grant <email>          da el rol admin
//   npm run admin -- revoke <email>         quita el rol admin
//   npm run admin -- seed-users             muestra si existen los usuarios
//                                           de prueba del seed
//   npm run admin -- seed-users --disable   los suspende y cierra sus sesiones
//
// Usa DATABASE_USER del .env: revisá a qué base apunta antes de correrlo.
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/user-cli/client';

// Deben coincidir con seed-user.ts.
const SEED_EMAILS = ['test@valsistem.dev', 'admin@valsistem.dev'];

const connectionString = process.env.DATABASE_USER?.trim();
if (!connectionString) {
  throw new Error('Falta DATABASE_USER en el .env del backend');
}
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function adminRole() {
  const existing = await prisma.role.findFirst({ where: { name: 'admin' } });
  if (existing) return existing;
  return prisma.role.create({
    data: {
      name: 'admin',
      description:
        'Acceso total a la plataforma, incluye endpoints administrativos.',
    },
  });
}

async function findUser(email: string | undefined) {
  if (!email) throw new Error('Falta el email');
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (!user) throw new Error(`No existe un usuario con email ${email}`);
  return user;
}

async function grant(email: string | undefined) {
  const user = await findUser(email);
  const role = await adminRole();
  await prisma.userRole.upsert({
    where: { roleId_userId: { roleId: role.id, userId: user.id } },
    create: { roleId: role.id, userId: user.id },
    update: {},
  });
  console.log(
    `${user.email} ahora es admin. Cerrá sesión y volvé a entrar para verlo.`,
  );
}

async function revoke(email: string | undefined) {
  const user = await findUser(email);
  const role = await adminRole();
  await prisma.userRole.deleteMany({
    where: { roleId: role.id, userId: user.id },
  });
  console.log(`${user.email} ya no es admin.`);
}

async function seedUsers(disable: boolean) {
  const users = await prisma.user.findMany({
    where: { email: { in: SEED_EMAILS } },
  });
  if (users.length === 0) {
    console.log('No hay usuarios de prueba del seed en esta base.');
    return;
  }
  for (const u of users) {
    console.log(
      `${u.email}: estado ${u.status}, último acceso ${u.lastLoginAt?.toISOString() ?? 'nunca'}`,
    );
  }
  if (!disable) {
    console.log('Para suspenderlos: npm run admin -- seed-users --disable');
    return;
  }
  const ids = users.map((u) => u.id);
  await prisma.$transaction([
    prisma.user.updateMany({
      where: { id: { in: ids } },
      data: { status: 'Suspended' },
    }),
    prisma.refreshToken.updateMany({
      where: { userId: { in: ids }, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
  console.log(
    `Suspendidos ${users.length} usuario(s) de prueba y cerradas sus sesiones.`,
  );
}

async function main() {
  const [command, arg] = process.argv.slice(2);
  switch (command) {
    case 'grant':
      return grant(arg);
    case 'revoke':
      return revoke(arg);
    case 'seed-users':
      return seedUsers(arg === '--disable');
    default:
      console.log(
        'Uso: npm run admin -- grant <email> | revoke <email> | seed-users [--disable]',
      );
  }
}

main()
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
