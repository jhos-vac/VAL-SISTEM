// Seed inicial del dominio Market: categorías, activos, Binance como
// exchange, tipo de mercado Spot y los trading pairs contra USDT.
// Correr con: npm run db:seed:market (requiere DATABASE_MARKET en .env
// y la base ya migrada — npm run db:migrate:market).
//
// Idempotente: usa upsert por cada unique key, así que se puede correr
// las veces que haga falta (p.ej. después de un db:reset:market) sin
// duplicar filas ni fallar por conflicto.
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/market-cli/client';

const connectionString = process.env.DATABASE_MARKET;
if (!connectionString) {
  throw new Error('Falta DATABASE_MARKET en el .env del backend');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

interface AssetSeed {
  symbol: string;
  name: string;
  category: string;
  website: string;
  whitepaper: string;
  description: string;
}

const CATEGORIES: Record<string, string> = {
  'Layer 1': 'Blockchains base con su propia red y consenso.',
  Stablecoin: 'Activos diseñados para mantener paridad con una moneda fiat.',
  'Exchange Token': 'Tokens nativos emitidos por un exchange.',
  Meme: 'Activos originados como broma o fenómeno de comunidad.',
  Pagos: 'Activos enfocados en transferencias y pagos rápidos.',
};

const ASSETS: AssetSeed[] = [
  {
    symbol: 'BTC',
    name: 'Bitcoin',
    category: 'Layer 1',
    website: 'https://bitcoin.org',
    whitepaper: 'https://bitcoin.org/bitcoin.pdf',
    description: 'La primera criptomoneda, red de pagos descentralizada.',
  },
  {
    symbol: 'ETH',
    name: 'Ethereum',
    category: 'Layer 1',
    website: 'https://ethereum.org',
    whitepaper: 'https://ethereum.org/whitepaper',
    description: 'Blockchain programable con contratos inteligentes.',
  },
  {
    symbol: 'BNB',
    name: 'BNB',
    category: 'Exchange Token',
    website: 'https://www.bnbchain.org',
    whitepaper: 'https://www.bnbchain.org/en/whitepaper',
    description: 'Token nativo del ecosistema BNB Chain / Binance.',
  },
  {
    symbol: 'SOL',
    name: 'Solana',
    category: 'Layer 1',
    website: 'https://solana.com',
    whitepaper: 'https://solana.com/solana-whitepaper.pdf',
    description: 'Blockchain de alto rendimiento orientada a baja latencia.',
  },
  {
    symbol: 'XRP',
    name: 'XRP',
    category: 'Pagos',
    website: 'https://ripple.com/xrp',
    whitepaper: 'https://ripple.com/files/ripple_consensus_whitepaper.pdf',
    description: 'Activo digital pensado para pagos transfronterizos.',
  },
  {
    symbol: 'ADA',
    name: 'Cardano',
    category: 'Layer 1',
    website: 'https://cardano.org',
    whitepaper: 'https://docs.cardano.org',
    description:
      'Blockchain de prueba de participación basada en investigación revisada por pares.',
  },
  {
    symbol: 'DOGE',
    name: 'Dogecoin',
    category: 'Meme',
    website: 'https://dogecoin.com',
    whitepaper: 'https://github.com/dogecoin/dogecoin',
    description: 'Criptomoneda originada como meme, con comunidad activa.',
  },
  {
    symbol: 'USDT',
    name: 'Tether',
    category: 'Stablecoin',
    website: 'https://tether.to',
    whitepaper: 'https://tether.to/en/whitepaper',
    description: 'Stablecoin referenciada 1:1 al dólar estadounidense.',
  },
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function main() {
  console.log('Seed Market: categorías...');
  const categoryIds = new Map<string, string>();
  for (const [name, description] of Object.entries(CATEGORIES)) {
    const cat = await prisma.assetCategorie.upsert({
      where: { name },
      create: { name, description },
      update: { description },
    });
    categoryIds.set(name, cat.id);
  }

  console.log('Seed Market: activos...');
  const assetIds = new Map<string, string>();
  for (const a of ASSETS) {
    const asset = await prisma.asset.upsert({
      where: { symbol: a.symbol },
      create: {
        symbol: a.symbol,
        name: a.name,
        slug: slugify(a.name),
        logoUrl: '',
        description: a.description,
        website: a.website,
        whitepaper: a.whitepaper,
        isActive: true,
        categoryId: categoryIds.get(a.category)!,
      },
      update: {
        name: a.name,
        description: a.description,
        website: a.website,
        whitepaper: a.whitepaper,
        categoryId: categoryIds.get(a.category)!,
      },
    });
    assetIds.set(a.symbol, asset.id);
  }

  console.log('Seed Market: Binance (exchange + market type Spot)...');
  const binance = await prisma.exchange.upsert({
    where: { slug: 'binance' },
    create: {
      name: 'Binance',
      slug: 'binance',
      website: 'https://www.binance.com',
      logoUrl: '',
      country: 'Global',
      isActive: true,
    },
    update: {},
  });

  const spot = await prisma.marketType.upsert({
    where: { name: 'Spot' },
    create: {
      name: 'Spot',
      description: 'Compra/venta al precio actual, sin apalancamiento.',
    },
    update: {},
  });

  console.log('Seed Market: trading pairs contra USDT...');
  const usdtId = assetIds.get('USDT')!;
  const baseSymbols = ASSETS.map((a) => a.symbol).filter((s) => s !== 'USDT');

  for (const base of baseSymbols) {
    const baseId = assetIds.get(base)!;
    const symbol = `${base}/USDT`;
    const exchangeSymbol = `${base}USDT`;

    const pair = await prisma.tradingPair.upsert({
      where: {
        baseAssetId_quoteAssetId: { baseAssetId: baseId, quoteAssetId: usdtId },
      },
      create: {
        baseAssetId: baseId,
        quoteAssetId: usdtId,
        symbol,
        isActive: true,
      },
      update: { symbol },
    });

    await prisma.exchangeMarket.upsert({
      where: {
        exchangeId_tradingPairId_marketTypeId: {
          exchangeId: binance.id,
          tradingPairId: pair.id,
          marketTypeId: spot.id,
        },
      },
      create: {
        exchangeId: binance.id,
        tradingPairId: pair.id,
        marketTypeId: spot.id,
        exchangeSymbol,
        isActive: true,
      },
      update: { exchangeSymbol, isActive: true },
    });
  }

  console.log('Seed Market completo.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
