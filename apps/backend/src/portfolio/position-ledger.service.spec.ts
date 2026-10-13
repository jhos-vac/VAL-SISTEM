import { PositionLedgerService } from './position-ledger.service';
import type { PortfolioPrismaService } from '../prisma/portfolio-prisma.service';

jest.mock('../prisma/portfolio-prisma.service', () => ({
  PortfolioPrismaService: class {},
}));

const spotWallet = {
  id: 'w-spot',
  portfolioId: 'p-1',
  walletName: 'Binance',
  address: 'binance:acc-1',
  network: 'Binance',
};

function setup({
  locked = true,
  wallets = [spotWallet],
}: { locked?: boolean; wallets?: Array<typeof spotWallet> } = {}) {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ locked }]),
    wallet: {
      findMany: jest.fn().mockResolvedValue(wallets),
      create: jest.fn(({ data }: { data: { address: string } }) =>
        Promise.resolve({ id: `w${data.address.slice(-6)}`, ...data }),
      ),
      update: jest.fn().mockResolvedValue({}),
    },
    transactionType: {
      findMany: jest.fn().mockResolvedValue([
        { id: 't-buy', code: 'buy' },
        { id: 't-sell', code: 'sell' },
      ]),
    },
    transaction: {
      deleteMany: jest.fn().mockResolvedValue({}),
      createMany: jest.fn().mockResolvedValue({}),
    },
    assetPosition: {
      deleteMany: jest.fn().mockResolvedValue({}),
      createMany: jest.fn().mockResolvedValue({}),
    },
  };
  const prisma = {
    $transaction: jest.fn(
      (fn: (t: typeof tx) => unknown, opts: { timeout: number }) => {
        expect(opts.timeout).toBeGreaterThan(5000);
        return fn(tx);
      },
    ),
  };
  const service = new PositionLedgerService(
    prisma as unknown as PortfolioPrismaService,
  );
  return { service, tx };
}

const trade = {
  side: 'buy' as const,
  quantity: 1,
  price: 100,
  fee: 0.1,
  total: 100,
  notes: 'Binance order 1',
  executedAt: new Date('2026-10-01T00:00:00Z'),
};

describe('PositionLedgerService.replaceExchangeSnapshot', () => {
  it('si otro sync de la misma cuenta está en curso, no toca nada', async () => {
    const { service, tx } = setup({ locked: false });
    await expect(
      service.replaceExchangeSnapshot('acc-1', {
        spot: [],
        earn: [],
        funding: [],
      }),
    ).resolves.toBe('busy');
    expect(tx.assetPosition.deleteMany).not.toHaveBeenCalled();
  });

  it('reemplaza posiciones y transacciones en lote, enlazadas por id', async () => {
    const { service, tx } = setup();
    await expect(
      service.replaceExchangeSnapshot('acc-1', {
        spot: [
          {
            assetId: 'a-btc',
            quantity: 1,
            avgPrice: 100,
            realizedProfit: 5,
            trades: [trade, { ...trade, side: 'sell' }],
          },
          {
            assetId: 'a-usdt',
            quantity: 50,
            avgPrice: 1,
            realizedProfit: 0,
            trades: [],
          },
        ],
        earn: [],
        funding: [],
      }),
    ).resolves.toBe('applied');

    expect(tx.transaction.deleteMany).toHaveBeenCalledWith({
      where: { assetPosition: { walletId: { in: ['w-spot'] } } },
    });
    const positions = (
      tx.assetPosition.createMany.mock.calls[0] as [
        { data: Array<{ id: string; assetId: string; walletId: string }> },
      ]
    )[0].data;
    expect(positions.map((p) => p.assetId)).toEqual(['a-btc', 'a-usdt']);
    const transactions = (
      tx.transaction.createMany.mock.calls[0] as [
        {
          data: Array<{ assetPositionId: string; transactionTypeId: string }>;
        },
      ]
    )[0].data;
    expect(transactions).toHaveLength(2);
    expect(
      transactions.every((t) => t.assetPositionId === positions[0].id),
    ).toBe(true);
    expect(transactions.map((t) => t.transactionTypeId)).toEqual([
      't-buy',
      't-sell',
    ]);
    // Sin sub-wallets no se renombra Spot.
    expect(tx.wallet.update).not.toHaveBeenCalled();
  });

  it('crea la wallet de Earn al aparecer saldo y renombra la principal a Spot', async () => {
    const { service, tx } = setup();
    await service.replaceExchangeSnapshot('acc-1', {
      spot: [],
      earn: [
        {
          assetId: 'a-bnb',
          quantity: 2,
          avgPrice: 300,
          realizedProfit: 0,
          trades: [],
        },
      ],
      funding: [],
    });
    expect(tx.wallet.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        address: 'binance:acc-1:earn',
        walletName: 'Binance · Earn',
        walletType: 'exchange',
      }) as unknown,
    });
    expect(tx.wallet.update).toHaveBeenCalledWith({
      where: { id: 'w-spot' },
      data: { walletName: 'Binance · Spot' },
    });
  });

  it('sin wallet Spot falla (y la transacción hace rollback)', async () => {
    const { service } = setup({ wallets: [] });
    await expect(
      service.replaceExchangeSnapshot('acc-1', {
        spot: [],
        earn: [],
        funding: [],
      }),
    ).rejects.toThrow('No existe una wallet');
  });
});
