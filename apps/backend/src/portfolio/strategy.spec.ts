import { computeDcaProgress, computeRebalance } from './strategy';

const btc = { assetId: 'btc', assetSymbol: 'BTC' };
const eth = { assetId: 'eth', assetSymbol: 'ETH' };
const usdt = { assetId: 'usdt', assetSymbol: 'USDT' };
const doge = { assetId: 'doge', assetSymbol: 'DOGE' };

describe('computeRebalance', () => {
  it('sugiere comprar lo que está por debajo y vender lo que está por encima', () => {
    const plan = computeRebalance(
      [
        { ...btc, targetPercent: 50 },
        { ...eth, targetPercent: 30 },
        { ...usdt, targetPercent: 20 },
      ],
      [
        { ...btc, value: 600 },
        { ...eth, value: 200 },
        { ...usdt, value: 200 },
      ],
    );
    expect(plan.totalValue).toBe(1000);
    const by = new Map(plan.rows.map((r) => [r.assetSymbol, r]));
    expect(by.get('BTC')).toMatchObject({
      currentPercent: 60,
      diffPercent: 10,
      suggestedTrade: -100,
    });
    expect(by.get('ETH')!.suggestedTrade).toBeCloseTo(100);
    expect(by.get('USDT')!.suggestedTrade).toBeCloseTo(0);
  });

  it('con objetivos al 100 %, lo que no tiene objetivo se sugiere vender', () => {
    const plan = computeRebalance(
      [{ ...btc, targetPercent: 100 }],
      [
        { ...btc, value: 800 },
        { ...doge, value: 200 },
      ],
    );
    const dogeRow = plan.rows.find((r) => r.assetSymbol === 'DOGE')!;
    expect(dogeRow).toMatchObject({ targetPercent: 0, suggestedTrade: -200 });
  });

  it('con objetivos por debajo del 100 %, lo que no tiene objetivo no se toca', () => {
    const plan = computeRebalance(
      [{ ...btc, targetPercent: 60 }],
      [
        { ...btc, value: 500 },
        { ...doge, value: 500 },
      ],
    );
    expect(plan.targetsSum).toBe(60);
    const dogeRow = plan.rows.find((r) => r.assetSymbol === 'DOGE')!;
    expect(dogeRow).toMatchObject({
      targetPercent: null,
      suggestedTrade: null,
    });
    expect(plan.rows.find((r) => r.assetSymbol === 'BTC')!.suggestedTrade).toBe(
      100,
    );
  });

  it('un objetivo sin tenencia sugiere comprarlo entero', () => {
    const plan = computeRebalance(
      [
        { ...btc, targetPercent: 50 },
        { ...eth, targetPercent: 50 },
      ],
      [{ ...btc, value: 1000 }],
    );
    expect(plan.rows.find((r) => r.assetSymbol === 'ETH')!.suggestedTrade).toBe(
      500,
    );
  });
});

describe('computeDcaProgress', () => {
  const start = new Date(Date.UTC(2026, 0, 1));
  const day = (d: number) => new Date(start.getTime() + d * 86_400_000);

  it('semanal: compras que ya tocaban contra lo comprado', () => {
    const p = computeDcaProgress(
      { amount: 50, frequency: 'weekly', startDate: start, endDate: null },
      [
        { executedAt: day(0), total: 50 },
        { executedAt: day(7), total: 50 },
        { executedAt: day(-3), total: 999 }, // antes del plan, no cuenta
      ],
      day(15),
    );
    // Fechas planeadas: día 0, 7 y 14 → 3 compras.
    expect(p.periodsDue).toBe(3);
    expect(p.plannedAmount).toBe(150);
    expect(p.investedAmount).toBe(100);
    expect(p.progress).toBeCloseTo(2 / 3);
    expect(p.nextDate).toBe(day(21).toISOString());
  });

  it('mensual usa meses de calendario', () => {
    const p = computeDcaProgress(
      { amount: 100, frequency: 'monthly', startDate: start, endDate: null },
      [],
      new Date(Date.UTC(2026, 2, 15)),
    );
    expect(p.periodsDue).toBe(3); // 1 ene, 1 feb, 1 mar
    expect(p.nextDate).toBe(new Date(Date.UTC(2026, 3, 1)).toISOString());
  });

  it('antes de empezar no hay nada planeado', () => {
    const p = computeDcaProgress(
      { amount: 100, frequency: 'weekly', startDate: start, endDate: null },
      [],
      day(-1),
    );
    expect(p).toMatchObject({ periodsDue: 0, plannedAmount: 0, progress: 0 });
  });

  it('con fecha de fin, deja de sumar y se marca terminado', () => {
    const p = computeDcaProgress(
      { amount: 10, frequency: 'weekly', startDate: start, endDate: day(10) },
      [{ executedAt: day(20), total: 10 }], // después del fin, no cuenta
      day(60),
    );
    expect(p.periodsDue).toBe(2); // día 0 y 7
    expect(p.investedAmount).toBe(0);
    expect(p).toMatchObject({ finished: true, nextDate: null });
  });
});
