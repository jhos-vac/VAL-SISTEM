import { carryForwardCost, costFromAcquisitions } from './acquisition-cost';

describe('costFromAcquisitions', () => {
  it('usa el precio de cada entrada en el momento en que ocurrió', () => {
    const r = costFromAcquisitions(
      3,
      [
        { quantity: 1, time: 1, price: 100 },
        { quantity: 2, time: 2, price: 130 },
      ],
      999,
    );
    expect(r?.avgPrice).toBeCloseTo(120);
    expect(r?.covered).toBe(3);
  });

  it('con FIFO lo que queda son las entradas más nuevas', () => {
    // Entraron 2 a 100 y después 2 a 200; se vendieron 2: quedan las de 200.
    const r = costFromAcquisitions(
      2,
      [
        { quantity: 2, time: 1, price: 100 },
        { quantity: 2, time: 2, price: 200 },
      ],
      999,
    );
    expect(r?.avgPrice).toBe(200);
  });

  it('lo no cubierto por entradas se valora al precio de respaldo', () => {
    // 1 de un depósito a 100; 1 sin registro (p. ej. Earn) a 150.
    const r = costFromAcquisitions(
      2,
      [{ quantity: 1, time: 1, price: 100 }],
      150,
    );
    expect(r?.avgPrice).toBe(125);
    expect(r?.covered).toBe(1);
  });

  it('sin entradas útiles devuelve null', () => {
    expect(costFromAcquisitions(1, [], 100)).toBeNull();
    expect(
      costFromAcquisitions(1, [{ quantity: 1, time: 1, price: 0 }], 100),
    ).toBeNull();
  });
});

describe('carryForwardCost', () => {
  it('el precio queda fijo aunque el mercado cambie', () => {
    expect(carryForwardCost({ quantity: 2, avgPrice: 100 }, 2, 300)).toBe(100);
  });

  it('si se vendió parte, el precio no cambia', () => {
    expect(carryForwardCost({ quantity: 2, avgPrice: 100 }, 1, 300)).toBe(100);
  });

  it('si llegó más moneda, solo lo nuevo se valora al precio actual', () => {
    expect(carryForwardCost({ quantity: 1, avgPrice: 100 }, 2, 300)).toBe(200);
  });
});
