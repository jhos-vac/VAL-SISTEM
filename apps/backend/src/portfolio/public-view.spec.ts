import {
  buildPublicStats,
  compositionToTargets,
  type PublicPosition,
} from './public-view';

const pos = (
  assetId: string,
  over: Partial<PublicPosition> = {},
): PublicPosition => ({
  assetId,
  assetSymbol: assetId.toUpperCase(),
  assetName: assetId,
  quantity: 1,
  averageCost: 100,
  currentValue: 100,
  realizedPnl: 0,
  unrealizedPnl: 0,
  changePercent24h: 0,
  ...over,
});

describe('buildPublicStats', () => {
  it('rendimiento sobre lo invertido, sin contar el capital', () => {
    const stats = buildPublicStats([
      pos('btc', { averageCost: 100, currentValue: 150, unrealizedPnl: 50 }),
      pos('usdt', {
        quantity: 50,
        averageCost: 1,
        currentValue: 50,
        isCapital: true,
      }),
    ]);
    expect(stats.returnPercent).toBeCloseTo(50);
    expect(stats.capitalPercent).toBeCloseTo(25); // 50 de 200
    expect(stats.hasInvestment).toBe(true);
  });

  it('la composición son solo porcentajes, agrupados por activo', () => {
    const stats = buildPublicStats([
      pos('btc', { currentValue: 300 }),
      pos('btc', { currentValue: 300 }), // otra wallet
      pos('eth', { currentValue: 400 }),
    ]);
    expect(stats.assetsCount).toBe(2);
    expect(stats.composition.map((c) => [c.assetSymbol, c.percent])).toEqual([
      ['BTC', 60],
      ['ETH', 40],
    ]);
    // Ningún monto en la salida.
    const keys = Object.keys(stats.composition[0]);
    expect(keys).not.toContain('currentValue');
    expect(keys).not.toContain('quantity');
    expect(keys).not.toContain('cost');
  });

  it('el capital no tiene rendimiento propio', () => {
    const stats = buildPublicStats([
      pos('usdt', { isCapital: true, unrealizedPnl: 1 }),
    ]);
    expect(stats.composition[0].returnPercent).toBeNull();
    expect(stats.hasInvestment).toBe(false);
  });
});

describe('compositionToTargets', () => {
  it('redondea hacia abajo para que la suma no pase de 100', () => {
    const stats = buildPublicStats([
      pos('a', { currentValue: 1 }),
      pos('b', { currentValue: 1 }),
      pos('c', { currentValue: 1 }),
    ]);
    const targets = compositionToTargets(stats.composition);
    expect(targets.map((t) => t.targetPercent)).toEqual([33.33, 33.33, 33.33]);
    expect(
      targets.reduce((s, t) => s + t.targetPercent, 0),
    ).toBeLessThanOrEqual(100);
  });
});
