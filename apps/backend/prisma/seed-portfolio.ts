// Seed inicial del dominio Portfolio: los 4 tipos de transacción que usa
// el alta manual (RFW-08) — buy/sell/transfer_in/transfer_out, alineados
// 1:1 con el union type `TransactionType` del frontend
// (packages/shared/src/types.ts) y con CreateTransactionDto del backend
// — y, si ya existe el usuario de prueba sembrado por
// `npm run db:seed:user`, un portafolio de ejemplo con un par de compras
// (BTC + ETH) para no arrancar con las pantallas vacías.
//
// Correr con: npm run db:seed:portfolio (requiere DATABASE_PORTFOLIO en
// .env y la base ya migrada — npm run db:migrate:portfolio). El
// portafolio de ejemplo además necesita DATABASE_USER/DATABASE_MARKET y
// que ya hayan corrido npm run db:seed:user / npm run db:seed:market —
// si no, se omite esa parte con un aviso, sin fallar el resto del seed.
//
// Idempotente: los tipos de transacción usan upsert por `code` (unique);
// el portafolio de ejemplo se salta si el usuario de prueba ya tiene uno
// con ese nombre, así que correr esto varias veces no duplica nada.
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/portfolio-cli/client';
import { PrismaClient as UserPrismaClient } from './generated/user-cli/client';
import { PrismaClient as MarketPrismaClient } from './generated/market-cli/client';

const connectionString = process.env.DATABASE_PORTFOLIO;
if (!connectionString) {
  throw new Error('Falta DATABASE_PORTFOLIO en el .env del backend');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

// Debe coincidir con TEST_USER.email en seed-user.ts.
const DEMO_TEST_USER_EMAIL = 'test@valsistem.dev';

const TRANSACTION_TYPES = [
  {
    code: 'buy',
    name: 'Compra',
    description: 'Compra de un activo — aumenta la posición.',
  },
  {
    code: 'sell',
    name: 'Venta',
    description:
      'Venta de un activo — reduce la posición y realiza ganancia/pérdida.',
  },
  {
    code: 'transfer_in',
    name: 'Transferencia entrante',
    description:
      'Entrada de un activo a la wallet sin ser una compra (depósito, traspaso).',
  },
  {
    code: 'transfer_out',
    name: 'Transferencia saliente',
    description:
      'Salida de un activo de la wallet sin ser una venta (retiro, traspaso).',
  },
];

async function seedTransactionTypes() {
  console.log('Seed Portfolio: tipos de transacción...');
  for (const t of TRANSACTION_TYPES) {
    await prisma.transactionType.upsert({
      where: { code: t.code },
      create: t,
      update: { name: t.name, description: t.description },
    });
  }
}

// Portafolio de ejemplo para el usuario de prueba — dos compras (BTC y
// ETH) creadas directamente como AssetPosition + Transaction, replicando
// a mano la misma lógica de costo promedio que usa
// src/portfolio/transaction.service.ts (acá ambas son altas desde cero,
// así que avgPrice = price de la única compra).
async function seedDemoPortfolio() {
  if (!process.env.DATABASE_USER || !process.env.DATABASE_MARKET) {
    console.warn(
      'Seed Portfolio: faltan DATABASE_USER/DATABASE_MARKET en el .env — se omite el portafolio de ejemplo.',
    );
    return;
  }

  const userPrisma = new UserPrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_USER }),
  });
  const marketPrisma = new MarketPrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_MARKET }),
  });

  try {
    const testUser = await userPrisma.user.findUnique({
      where: { email: DEMO_TEST_USER_EMAIL },
    });
    if (!testUser) {
      console.warn(
        'Seed Portfolio: no existe el usuario de prueba todavía (corré npm run db:seed:user primero) — se omite el portafolio de ejemplo.',
      );
      return;
    }

    const alreadyExists = await prisma.portfolio.findFirst({
      where: { userId: testUser.id, name: 'Mi Portafolio' },
    });
    if (alreadyExists) {
      console.log(
        'Seed Portfolio: el portafolio de ejemplo del usuario de prueba ya existe, no se duplica.',
      );
      return;
    }

    const [btc, eth] = await Promise.all([
      marketPrisma.asset.findUnique({ where: { symbol: 'BTC' } }),
      marketPrisma.asset.findUnique({ where: { symbol: 'ETH' } }),
    ]);
    if (!btc || !eth) {
      console.warn(
        'Seed Portfolio: faltan BTC/ETH en el catálogo de Market (corré npm run db:seed:market primero) — se omite el portafolio de ejemplo.',
      );
      return;
    }

    const buyType = await prisma.transactionType.findUnique({
      where: { code: 'buy' },
    });
    if (!buyType) return; // no debería pasar — se acaba de sembrar arriba en el mismo run

    console.log(
      'Seed Portfolio: portafolio de ejemplo para el usuario de prueba...',
    );

    const demoBuys = [
      { asset: btc, quantity: 0.05, price: 60000, daysAgo: 30 },
      { asset: eth, quantity: 1.5, price: 2500, daysAgo: 15 },
    ];

    await prisma.$transaction(async (tx) => {
      const portfolio = await tx.portfolio.create({
        data: {
          userId: testUser.id,
          name: 'Mi Portafolio',
          description:
            'Portafolio de ejemplo generado automáticamente para probar la app.',
          baseCurrency: 'USD',
          isDefault: true,
        },
      });

      const wallet = await tx.wallet.create({
        data: {
          portfolioId: portfolio.id,
          walletName: 'Principal',
          walletType: 'manual',
          address: `manual:seed-${portfolio.id}`,
          network: 'N/A',
        },
      });

      for (const buy of demoBuys) {
        const position = await tx.assetPosition.create({
          data: {
            walletId: wallet.id,
            assetId: buy.asset.id,
            quantity: buy.quantity,
            avgPrice: buy.price,
            realizedProfit: 0,
            unrealizedProfit: 0,
          },
        });

        await tx.transaction.create({
          data: {
            assetPositionId: position.id,
            transactionTypeId: buyType.id,
            quantity: buy.quantity,
            price: buy.price,
            fee: 0,
            total: buy.quantity * buy.price,
            notes: 'Compra de ejemplo (seed)',
            executedAt: new Date(
              Date.now() - buy.daysAgo * 24 * 60 * 60 * 1000,
            ),
          },
        });
      }
    });

    console.log(
      'Seed Portfolio: portafolio de ejemplo creado (BTC + ETH para el usuario de prueba).',
    );
  } finally {
    await userPrisma.$disconnect();
    await marketPrisma.$disconnect();
  }
}

async function main() {
  await seedTransactionTypes();
  await seedDemoPortfolio();
  console.log('Seed Portfolio completo.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
