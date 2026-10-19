import { BinanceAccountSyncService } from './binance-account-sync.service';
import type { MarketService } from '../market/market.service';
import type { BinanceTickerSyncService } from '../market/binance-ticker-sync.service';
import type {
  AcquisitionRecord,
  BinanceAccountClientService,
} from './binance-account-client.service';
import type { ExchangeAccountStore } from '../portfolio/exchange-account.store';
import type {
  ExchangeAccountSnapshot,
  PositionLedgerService,
  StoredCost,
} from '../portfolio/position-ledger.service';

// Dependencias con Prisma (ESM) que Jest no carga; se pasan dobles.
jest.mock('../market/market.service', () => ({ MarketService: class {} }));
jest.mock('../market/binance-ticker-sync.service', () => ({
  BinanceTickerSyncService: class {},
}));
jest.mock('../portfolio/exchange-account.store', () => ({
  ExchangeAccountStore: class {},
}));
jest.mock('../portfolio/position-ledger.service', () => ({
  PositionLedgerService: class {},
}));
jest.mock('../common/security/encryption.util', () => ({
  decryptSecret: (s: string) => s,
}));

const catalog = [
  { id: 'a-btc', symbol: 'BTC' },
  { id: 'a-bnb', symbol: 'BNB' },
  { id: 'a-usdt', symbol: 'USDT' },
];

function setup(
  ledgerOutcome: 'applied' | 'busy' = 'applied',
  previousCosts = new Map<string, StoredCost>(),
  deposits: AcquisitionRecord[] = [],
) {
  const binance = {
    getAccountSnapshot: jest.fn().mockResolvedValue({
      balances: [
        { asset: 'BTC', total: 1 },
        { asset: 'BNB', total: 2 },
        { asset: 'USDT', total: 50 },
      ],
    }),
    // BNB también está en Earn: su historial va una sola vez (en Spot).
    getEarnBalances: jest.fn().mockResolvedValue([{ asset: 'BNB', total: 3 }]),
    getFundingBalances: jest.fn().mockResolvedValue([]),
    getDeposits: jest.fn().mockResolvedValue(deposits),
    getConvertTrades: jest.fn().mockResolvedValue([]),
    getFiatBuys: jest.fn().mockResolvedValue([]),
    // Precio histórico: BTC valía 40.000 cuando se depositó.
    getPriceAt: jest.fn().mockResolvedValue(40000),
    getMyTrades: jest.fn((_k: string, _s: string, pair: string) =>
      Promise.resolve(
        pair === 'BNBUSDT'
          ? [
              {
                orderId: 1,
                price: 300,
                qty: 5,
                quoteQty: 1500,
                commission: 0.01,
                commissionAsset: 'BNB',
                time: Date.UTC(2026, 8, 1),
                isBuyer: true,
              },
            ]
          : [],
      ),
    ),
  };
  const market = {
    resolveEarnAliases: jest.fn().mockResolvedValue(new Map()),
    deactivateAssets: jest.fn().mockResolvedValue(undefined),
    ensureAssets: jest.fn().mockResolvedValue([]),
    getAssets: jest.fn().mockResolvedValue(catalog),
    getPricesByAssetIds: jest.fn().mockResolvedValue(
      new Map([
        ['a-btc', { price: 60000 }],
        ['a-bnb', { price: 350 }],
      ]),
    ),
  };
  const accounts = { recordSync: jest.fn().mockResolvedValue(undefined) };
  const ledger = {
    replaceExchangeSnapshot: jest.fn().mockResolvedValue(ledgerOutcome),
    currentCosts: jest.fn().mockResolvedValue(previousCosts),
  };
  const service = new BinanceAccountSyncService(
    market as unknown as MarketService,
    { syncAll: jest.fn() } as unknown as BinanceTickerSyncService,
    binance as unknown as BinanceAccountClientService,
    accounts as unknown as ExchangeAccountStore,
    ledger as unknown as PositionLedgerService,
  );
  return { service, binance, accounts, ledger };
}

const account = { id: 'acc-1', apiKey: 'k', apiSecret: 's', isTestnet: false };

describe('BinanceAccountSyncService.syncAccount', () => {
  it('arma la foto por wallet y el historial se cuenta una sola vez', async () => {
    const { service, ledger, accounts } = setup();
    const result = await service.syncAccount(account);
    expect(result.status).toBe('completed');

    const snapshot = (
      ledger.replaceExchangeSnapshot.mock.calls[0] as [
        string,
        ExchangeAccountSnapshot,
      ]
    )[1];
    const spotBnb = snapshot.spot.find((h) => h.assetId === 'a-bnb')!;
    const earnBnb = snapshot.earn.find((h) => h.assetId === 'a-bnb')!;
    expect(spotBnb.trades).toHaveLength(1);
    expect(spotBnb.avgPrice).toBe(300);
    expect(earnBnb.trades).toHaveLength(0);
    // El costo base es el mismo en las dos wallets.
    expect(earnBnb.avgPrice).toBe(300);

    // USDT a 1, y BTC sin trades ni registro de entrada: precio de hoy.
    expect(snapshot.spot.find((h) => h.assetId === 'a-usdt')!.avgPrice).toBe(1);
    const btc = snapshot.spot.find((h) => h.assetId === 'a-btc')!;
    expect(btc.avgPrice).toBe(60000);
    expect(btc.costSource).toBe('first_seen');
    expect(accounts.recordSync).toHaveBeenCalledWith(
      'acc-1',
      expect.objectContaining({ status: 'completed' }) as unknown,
    );
  });

  it('sin trades, el precio de compra sale del depósito en su momento', async () => {
    const { service, ledger, binance } = setup('applied', new Map(), [
      { asset: 'BTC', quantity: 1, time: Date.UTC(2026, 0, 1), price: null },
    ]);
    await service.syncAccount(account);
    const snapshot = (
      ledger.replaceExchangeSnapshot.mock.calls[0] as [
        string,
        ExchangeAccountSnapshot,
      ]
    )[1];
    const btc = snapshot.spot.find((h) => h.assetId === 'a-btc')!;
    expect(binance.getPriceAt).toHaveBeenCalledWith(
      'BTC',
      Date.UTC(2026, 0, 1),
    );
    expect(btc.avgPrice).toBe(40000);
    expect(btc.costSource).toBe('history');
  });

  it('un precio ya fijado no cambia aunque el mercado suba', async () => {
    const fixedAt = new Date(Date.UTC(2026, 5, 1));
    const { service, ledger, binance } = setup(
      'applied',
      new Map([
        [
          'a-btc',
          {
            quantity: 1,
            avgPrice: 50000,
            costSource: 'first_seen',
            costFixedAt: fixedAt,
          },
        ],
      ]),
    );
    await service.syncAccount(account);
    const snapshot = (
      ledger.replaceExchangeSnapshot.mock.calls[0] as [
        string,
        ExchangeAccountSnapshot,
      ]
    )[1];
    const btc = snapshot.spot.find((h) => h.assetId === 'a-btc')!;
    expect(btc.avgPrice).toBe(50000);
    expect(btc.costFixedAt).toEqual(fixedAt);
    // No vuelve a buscar historial de una moneda que ya tiene precio fijo.
    expect(binance.getDeposits).not.toHaveBeenCalled();
  });

  it('las posiciones calculadas con la lógica vieja se vuelven a valorar', async () => {
    const { service, ledger } = setup(
      'applied',
      new Map([
        [
          'a-btc',
          {
            quantity: 1,
            avgPrice: 60000,
            costSource: 'legacy',
            costFixedAt: null,
          },
        ],
      ]),
      [{ asset: 'BTC', quantity: 1, time: Date.UTC(2026, 0, 1), price: 38000 }],
    );
    await service.syncAccount(account);
    const snapshot = (
      ledger.replaceExchangeSnapshot.mock.calls[0] as [
        string,
        ExchangeAccountSnapshot,
      ]
    )[1];
    expect(snapshot.spot.find((h) => h.assetId === 'a-btc')!.avgPrice).toBe(
      38000,
    );
  });

  it('si ya hay un sync en curso de la cuenta, devuelve skipped sin registrar', async () => {
    const { service, accounts } = setup('busy');
    await expect(service.syncAccount(account)).resolves.toMatchObject({
      status: 'skipped',
    });
    expect(accounts.recordSync).not.toHaveBeenCalled();
  });

  it('si Binance falla, registra el sync como fallido', async () => {
    const { service, binance, accounts, ledger } = setup();
    binance.getAccountSnapshot.mockRejectedValueOnce(new Error('Invalid key'));
    await expect(service.syncAccount(account)).resolves.toMatchObject({
      status: 'failed',
      message: 'Invalid key',
    });
    expect(ledger.replaceExchangeSnapshot).not.toHaveBeenCalled();
    expect(accounts.recordSync).toHaveBeenCalledWith(
      'acc-1',
      expect.objectContaining({ status: 'failed' }) as unknown,
    );
  });
});
