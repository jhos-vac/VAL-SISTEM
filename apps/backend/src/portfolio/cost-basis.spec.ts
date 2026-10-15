import {
  applyMovement,
  computeCostBasisFromTrades,
  InsufficientQuantityError,
  summarizePositions,
  valuePosition,
  type PositionMovement,
  type PositionState,
} from './cost-basis';

const replay = (movements: PositionMovement[]): PositionState =>
  movements.reduce<PositionState>((pos, m) => applyMovement(pos, m), {
    quantity: 0,
    avgPrice: 0,
    realizedProfit: 0,
  });

describe('applyMovement (alta manual)', () => {
  it('la primera compra fija el costo promedio al precio pagado', () => {
    expect(
      applyMovement(null, { type: 'buy', quantity: 2, price: 100 }),
    ).toEqual({ quantity: 2, avgPrice: 100, realizedProfit: 0 });
  });

  it('compras sucesivas promedian ponderado por cantidad', () => {
    const pos = replay([
      { type: 'buy', quantity: 1, price: 100 },
      { type: 'buy', quantity: 3, price: 200 },
    ]);
    expect(pos.quantity).toBe(4);
    expect(pos.avgPrice).toBeCloseTo(175); // (100 + 600) / 4
    expect(pos.realizedProfit).toBe(0);
  });

  it('transfer_in también recalcula el costo promedio', () => {
    const pos = replay([
      { type: 'buy', quantity: 1, price: 100 },
      { type: 'transfer_in', quantity: 1, price: 300 },
    ]);
    expect(pos.avgPrice).toBeCloseTo(200);
  });

  it('la venta no cambia el costo promedio y acumula ganancia realizada', () => {
    const pos = replay([
      { type: 'buy', quantity: 4, price: 100 },
      { type: 'sell', quantity: 1, price: 150 },
    ]);
    expect(pos).toEqual({ quantity: 3, avgPrice: 100, realizedProfit: 50 });
  });

  it('la venta con pérdida da ganancia realizada negativa', () => {
    const pos = replay([
      { type: 'buy', quantity: 2, price: 100 },
      { type: 'sell', quantity: 2, price: 80 },
    ]);
    expect(pos.realizedProfit).toBeCloseTo(-40);
    expect(pos.quantity).toBe(0);
  });

  it('la comisión de la venta se descuenta de la ganancia realizada', () => {
    const pos = replay([
      { type: 'buy', quantity: 1, price: 100 },
      { type: 'sell', quantity: 1, price: 150, fee: 2 },
    ]);
    expect(pos.realizedProfit).toBeCloseTo(48);
  });

  it('la comisión de una compra no altera el costo promedio', () => {
    const pos = applyMovement(null, {
      type: 'buy',
      quantity: 1,
      price: 100,
      fee: 5,
    });
    expect(pos.avgPrice).toBe(100);
  });

  it('transfer_out resta cantidad sin generar ganancia realizada', () => {
    const pos = replay([
      { type: 'buy', quantity: 2, price: 100 },
      { type: 'transfer_out', quantity: 1, price: 500, fee: 1 },
    ]);
    expect(pos).toEqual({ quantity: 1, avgPrice: 100, realizedProfit: 0 });
  });

  it('vender más de lo que hay falla', () => {
    const pos: PositionState = {
      quantity: 1,
      avgPrice: 100,
      realizedProfit: 0,
    };
    expect(() =>
      applyMovement(pos, { type: 'sell', quantity: 2, price: 100 }),
    ).toThrow(InsufficientQuantityError);
    expect(() =>
      applyMovement(null, { type: 'transfer_out', quantity: 1, price: 100 }),
    ).toThrow(InsufficientQuantityError);
  });

  it('se puede vender exactamente toda la posición', () => {
    const pos = replay([
      { type: 'buy', quantity: 0.5, price: 60000 },
      { type: 'sell', quantity: 0.5, price: 62000 },
    ]);
    expect(pos.quantity).toBe(0);
    expect(pos.realizedProfit).toBeCloseTo(1000);
  });

  it('recomprar tras cerrar la posición arranca un costo promedio nuevo', () => {
    const pos = replay([
      { type: 'buy', quantity: 1, price: 100 },
      { type: 'sell', quantity: 1, price: 120 },
      { type: 'buy', quantity: 2, price: 50 },
    ]);
    expect(pos).toEqual({ quantity: 2, avgPrice: 50, realizedProfit: 20 });
  });

  it('acumula la ganancia realizada de varias ventas', () => {
    const pos = replay([
      { type: 'buy', quantity: 3, price: 10 },
      { type: 'sell', quantity: 1, price: 20 },
      { type: 'buy', quantity: 2, price: 25 }, // avg = (2*10 + 2*25)/4 = 17.5
      { type: 'sell', quantity: 2, price: 30 },
    ]);
    expect(pos.quantity).toBe(2);
    expect(pos.avgPrice).toBeCloseTo(17.5);
    expect(pos.realizedProfit).toBeCloseTo(10 + 25);
  });

  it('no muta la posición recibida', () => {
    const pos: PositionState = {
      quantity: 1,
      avgPrice: 100,
      realizedProfit: 0,
    };
    applyMovement(pos, { type: 'buy', quantity: 1, price: 200 });
    expect(pos).toEqual({ quantity: 1, avgPrice: 100, realizedProfit: 0 });
  });
});

describe('computeCostBasisFromTrades (sync de Binance)', () => {
  const buy = (qty: number, price: number) => ({ isBuyer: true, qty, price });
  const sell = (qty: number, price: number) => ({ isBuyer: false, qty, price });

  it('sin trades devuelve costo 0', () => {
    expect(computeCostBasisFromTrades([])).toEqual({
      avgPrice: 0,
      realizedProfit: 0,
    });
  });

  it('coincide con el cálculo del alta manual para el mismo historial', () => {
    const fromTrades = computeCostBasisFromTrades([
      buy(3, 10),
      sell(1, 20),
      buy(2, 25),
      sell(2, 30),
    ]);
    const manual = replay([
      { type: 'buy', quantity: 3, price: 10 },
      { type: 'sell', quantity: 1, price: 20 },
      { type: 'buy', quantity: 2, price: 25 },
      { type: 'sell', quantity: 2, price: 30 },
    ]);
    expect(fromTrades.avgPrice).toBeCloseTo(manual.avgPrice);
    expect(fromTrades.realizedProfit).toBeCloseTo(manual.realizedProfit);
  });

  it('una venta mayor a lo comprado se recorta a lo disponible', () => {
    // Vende 5 pero solo compró 2 ahí (el resto vino de un depósito).
    const result = computeCostBasisFromTrades([buy(2, 100), sell(5, 150)]);
    expect(result.realizedProfit).toBeCloseTo(100); // 2 * (150 - 100)
  });

  it('tras vender de más, la siguiente compra fija un costo nuevo', () => {
    const result = computeCostBasisFromTrades([
      buy(1, 100),
      sell(3, 150),
      buy(1, 40),
    ]);
    expect(result.avgPrice).toBeCloseTo(40);
  });

  it('una venta sin compras previas no genera ganancia', () => {
    expect(computeCostBasisFromTrades([sell(1, 100)])).toEqual({
      avgPrice: 0,
      realizedProfit: 0,
    });
  });

  it('maneja cantidades fraccionarias típicas de cripto', () => {
    const result = computeCostBasisFromTrades([
      buy(0.001, 60000),
      buy(0.003, 64000),
    ]);
    expect(result.avgPrice).toBeCloseTo(63000, 6);
  });
});

describe('valuePosition', () => {
  it('ganancia no realizada = cantidad × (precio actual − costo promedio)', () => {
    expect(valuePosition(2, 100, 130)).toEqual({
      currentPrice: 130,
      currentValue: 260,
      unrealizedPnl: 60,
    });
  });

  it('refleja pérdidas no realizadas', () => {
    expect(valuePosition(2, 100, 70).unrealizedPnl).toBeCloseTo(-60);
  });

  it('sin precio de mercado usa el costo promedio (ganancia 0)', () => {
    expect(valuePosition(3, 50, undefined)).toEqual({
      currentPrice: 50,
      currentValue: 150,
      unrealizedPnl: 0,
    });
  });

  it('un precio de mercado 0 se respeta (no cae al costo promedio)', () => {
    expect(valuePosition(1, 50, 0).unrealizedPnl).toBe(-50);
  });
});

describe('summarizePositions', () => {
  it('un portafolio vacío da todo en 0', () => {
    expect(summarizePositions([])).toEqual({
      totalValue: 0,
      capitalValue: 0,
      totalInvested: 0,
      realizedPnl: 0,
      unrealizedPnl: 0,
      changePercent24h: 0,
    });
  });

  it('suma valores y pondera la variación 24h por peso en el total', () => {
    const totals = summarizePositions([
      {
        quantity: 1,
        averageCost: 100,
        currentValue: 300,
        realizedPnl: 10,
        unrealizedPnl: 200,
        changePercent24h: 10,
      },
      {
        quantity: 2,
        averageCost: 60,
        currentValue: 100,
        realizedPnl: -5,
        unrealizedPnl: -20,
        changePercent24h: -2,
      },
    ]);
    expect(totals.totalValue).toBe(400);
    expect(totals.totalInvested).toBe(220);
    expect(totals.realizedPnl).toBe(5);
    expect(totals.unrealizedPnl).toBe(180);
    // 10 * 0.75 + (-2) * 0.25
    expect(totals.changePercent24h).toBeCloseTo(7);
  });

  it('las monedas capital quedan fuera del portafolio y se informan aparte', () => {
    const btc = {
      quantity: 1,
      averageCost: 100,
      currentValue: 150,
      realizedPnl: 10,
      unrealizedPnl: 50,
      changePercent24h: 4,
    };
    const usdt = {
      quantity: 500,
      averageCost: 1,
      currentValue: 500.5,
      realizedPnl: 3,
      unrealizedPnl: 0.5,
      changePercent24h: 0.1,
      isCapital: true,
    };
    const totals = summarizePositions([btc, usdt]);
    expect(totals.totalValue).toBeCloseTo(150);
    expect(totals.capitalValue).toBeCloseTo(500.5);
    expect(totals.totalInvested).toBe(100);
    expect(totals.realizedPnl).toBe(10);
    expect(totals.unrealizedPnl).toBe(50);
    // Sin el capital, la variación 24h es solo la del BTC.
    expect(totals.changePercent24h).toBeCloseTo(4);
  });

  it('un portafolio solo con capital no tiene ganancia ni variación', () => {
    const totals = summarizePositions([
      {
        quantity: 100,
        averageCost: 1,
        currentValue: 100,
        realizedPnl: 0,
        unrealizedPnl: 0,
        changePercent24h: 0.2,
        isCapital: true,
      },
    ]);
    expect(totals).toMatchObject({
      totalValue: 0,
      capitalValue: 100,
      totalInvested: 0,
      unrealizedPnl: 0,
      changePercent24h: 0,
    });
  });
});
