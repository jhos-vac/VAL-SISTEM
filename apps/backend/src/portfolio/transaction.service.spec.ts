import { BadRequestException } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import type { PortfolioPrismaService } from '../prisma/portfolio-prisma.service';
import type { PortfolioService } from './portfolio.service';
import type { MarketService } from '../market/market.service';
import type { CreateTransactionDto } from './dto/create-transaction.dto';

// Los servicios reales importan el cliente generado de Prisma (ESM), que
// Jest no carga; acá no hacen falta porque se pasan dobles por constructor.
jest.mock('../prisma/portfolio-prisma.service', () => ({
  PortfolioPrismaService: class {},
}));
jest.mock('./portfolio.service', () => ({ PortfolioService: class {} }));
jest.mock('../market/market.service', () => ({ MarketService: class {} }));

type Data = { data: Record<string, unknown> };

// Prisma simulado en memoria: solo lo que usa TransactionService.create.
function setup(existing?: {
  quantity: number;
  avgPrice: number;
  realizedProfit: number;
}) {
  const positionRow = existing ? { id: 'pos-1', ...existing } : null;
  const tx = {
    assetPosition: {
      findUnique: jest.fn().mockResolvedValue(positionRow),
      update: jest.fn(({ data }: Data) =>
        Promise.resolve({ id: 'pos-1', ...data }),
      ),
      create: jest.fn(({ data }: Data) =>
        Promise.resolve({ id: 'pos-new', ...data }),
      ),
    },
    transaction: {
      create: jest.fn(({ data }: Data) =>
        Promise.resolve({ id: 'tx-1', notes: null, ...data }),
      ),
    },
  };
  const prisma = {
    wallet: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'w-1',
        portfolioId: 'p-1',
        portfolio: { userId: 'u-1' },
      }),
    },
    transactionType: {
      findUnique: jest.fn(({ where }: { where: { code: string } }) =>
        Promise.resolve({ id: `type-${where.code}`, code: where.code }),
      ),
    },
    $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const market = {
    getAssetBySymbol: jest
      .fn()
      .mockResolvedValue({ id: 'a-btc', symbol: 'BTC' }),
  };
  const service = new TransactionService(
    prisma as unknown as PortfolioPrismaService,
    {} as PortfolioService,
    market as unknown as MarketService,
  );
  return { service, tx };
}

const dto = (over: Partial<CreateTransactionDto>): CreateTransactionDto => ({
  walletId: 'w-1',
  assetSymbol: 'BTC',
  type: 'buy',
  quantity: 1,
  price: 100,
  executedAt: '2026-10-01T00:00:00.000Z',
  ...over,
});

describe('TransactionService.create', () => {
  it('crea la posición con el precio de la primera compra', async () => {
    const { service, tx } = setup();
    await service.create('u-1', dto({ quantity: 2, price: 100 }));
    expect(tx.assetPosition.create.mock.calls[0][0].data).toMatchObject({
      quantity: 2,
      avgPrice: 100,
      realizedProfit: 0,
    });
    expect(tx.transaction.create.mock.calls[0][0].data).toMatchObject({
      total: 200,
      fee: 0,
    });
  });

  it('una venta actualiza la ganancia realizada acumulada', async () => {
    const { service, tx } = setup({
      quantity: 4,
      avgPrice: 100,
      realizedProfit: 30,
    });
    await service.create(
      'u-1',
      dto({ type: 'sell', quantity: 1, price: 150, fee: 2 }),
    );
    expect(tx.assetPosition.update.mock.calls[0][0].data).toMatchObject({
      quantity: 3,
      avgPrice: 100,
      realizedProfit: 30 + 48,
    });
  });

  it('vender más de lo disponible responde 400 y no guarda nada', async () => {
    const { service, tx } = setup({
      quantity: 1,
      avgPrice: 100,
      realizedProfit: 0,
    });
    await expect(
      service.create('u-1', dto({ type: 'sell', quantity: 2 })),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.assetPosition.update).not.toHaveBeenCalled();
    expect(tx.transaction.create).not.toHaveBeenCalled();
  });
});
