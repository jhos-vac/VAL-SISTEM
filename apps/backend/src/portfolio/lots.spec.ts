import { buildLots, valueLot, type LotMovement } from './lots';

let seq = 0;
const at = (day: number) => new Date(Date.UTC(2026, 0, day));
const mv = (
  type: LotMovement['type'],
  quantity: number,
  price: number,
  day: number,
): LotMovement => ({
  id: `t${++seq}`,
  type,
  quantity,
  price,
  executedAt: at(day),
});

describe('buildLots (FIFO)', () => {
  it('cada compra es un lote con su propio precio', () => {
    const { lots } = buildLots([mv('buy', 1, 100, 1), mv('buy', 2, 150, 2)]);
    expect(lots.map((l) => [l.quantity, l.price, l.remaining])).toEqual([
      [1, 100, 1],
      [2, 150, 2],
    ]);
  });

  it('las ventas consumen primero los lotes más viejos', () => {
    const { lots } = buildLots([
      mv('buy', 1, 100, 1),
      mv('buy', 2, 150, 2),
      mv('sell', 1.5, 200, 3),
    ]);
    expect(lots[0].remaining).toBe(0);
    expect(lots[0].realizedPnl).toBeCloseTo(100); // 1 × (200 − 100)
    expect(lots[1].remaining).toBeCloseTo(1.5);
    expect(lots[1].realizedPnl).toBeCloseTo(25); // 0.5 × (200 − 150)
  });

  it('se ordena por fecha aunque llegue desordenado', () => {
    const { lots } = buildLots([mv('sell', 1, 200, 5), mv('buy', 1, 100, 1)]);
    expect(lots[0].remaining).toBe(0);
    expect(lots[0].realizedPnl).toBeCloseTo(100);
  });

  it('una salida (transfer_out) consume lotes sin ganancia realizada', () => {
    const { lots } = buildLots([
      mv('buy', 2, 100, 1),
      mv('transfer_out', 1, 999, 2),
    ]);
    expect(lots[0].remaining).toBe(1);
    expect(lots[0].realizedPnl).toBe(0);
  });

  it('una entrada (transfer_in) abre un lote', () => {
    const { lots } = buildLots([mv('transfer_in', 3, 50, 1)]);
    expect(lots[0]).toMatchObject({ source: 'transfer_in', remaining: 3 });
  });

  it('lo vendido sin lote previo (depósito sin compra) se informa aparte', () => {
    const result = buildLots([mv('buy', 1, 100, 1), mv('sell', 3, 120, 2)]);
    expect(result.lots[0].remaining).toBe(0);
    expect(result.unmatchedOut).toBeCloseTo(2);
  });

  it('no deja restos negativos por redondeo', () => {
    const { lots } = buildLots([
      mv('buy', 0.1, 100, 1),
      mv('buy', 0.2, 100, 2),
      mv('sell', 0.3, 100, 3),
    ]);
    expect(lots.every((l) => l.remaining === 0)).toBe(true);
  });
});

describe('valueLot', () => {
  it('valor y ganancia del lote con el precio actual', () => {
    const lot = buildLots([mv('buy', 2, 100, 1)]).lots[0];
    expect(valueLot(lot, 130)).toMatchObject({
      invested: 200,
      currentValue: 260,
      unrealizedPnl: 60,
      unrealizedPercent: 30,
      isOpen: true,
    });
  });

  it('un lote cerrado vale 0 y no tiene ganancia no realizada', () => {
    const lot = buildLots([mv('buy', 1, 100, 1), mv('sell', 1, 150, 2)])
      .lots[0];
    expect(valueLot(lot, 500)).toMatchObject({
      currentValue: 0,
      unrealizedPnl: 0,
      isOpen: false,
      realizedPnl: 50,
    });
  });
});
