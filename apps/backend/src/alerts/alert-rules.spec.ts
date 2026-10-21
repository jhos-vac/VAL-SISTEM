import {
  cooldownPassed,
  crossed,
  dcaDueNotification,
  goalEvents,
  maxDrift,
  moveMet,
  priceMet,
  type DcaForAlert,
  type GoalForEvents,
} from './alert-rules';

const now = new Date('2026-10-21T15:00:00Z');
const money = (n: number) => `$${n}`;

describe('precio de una moneda', () => {
  it('arriba o abajo del umbral', () => {
    expect(priceMet('price_above', 100, 90)).toBe(true);
    expect(priceMet('price_above', 80, 90)).toBe(false);
    expect(priceMet('price_below', 80, 90)).toBe(true);
  });

  it('avisa solo al cruzar, no mientras sigue del otro lado', () => {
    expect(crossed(true, false)).toBe(true);
    expect(crossed(true, true)).toBe(false);
    expect(crossed(false, true)).toBe(false);
  });
});

describe('movimientos y espera entre avisos', () => {
  it('movimiento fuerte en cualquier dirección', () => {
    expect(moveMet(-6, 5)).toBe(true);
    expect(moveMet(4.9, 5)).toBe(false);
  });

  it('respeta la espera de 12 h entre avisos de movimiento', () => {
    const tenHoursAgo = new Date(now.getTime() - 10 * 3_600_000);
    const thirteenHoursAgo = new Date(now.getTime() - 13 * 3_600_000);
    expect(cooldownPassed('asset_move', tenHoursAgo, now)).toBe(false);
    expect(cooldownPassed('asset_move', thirteenHoursAgo, now)).toBe(true);
    expect(cooldownPassed('asset_move', null, now)).toBe(true);
  });
});

describe('estrategia', () => {
  it('toma el mayor desvío absoluto', () => {
    expect(
      maxDrift([
        { assetSymbol: 'BTC', diffPercent: 3 },
        { assetSymbol: 'ETH', diffPercent: -7 },
        { assetSymbol: 'SOL', diffPercent: null },
      ]),
    ).toEqual({ assetSymbol: 'ETH', diff: -7 });
  });
});

describe('metas', () => {
  const goal = (over: Partial<GoalForEvents>): GoalForEvents => ({
    id: 'g1',
    name: 'Fondo',
    kind: 'target_value',
    progress: { status: 'in_progress', progress: 0.1 },
    projection: null,
    ...over,
  });

  it('cumplida: un solo aviso, sin hitos', () => {
    const e = goalEvents(
      'u1',
      goal({ progress: { status: 'achieved', progress: 1 } }),
      now,
    );
    expect(e.map((x) => x.dedupeKey)).toEqual(['goal:g1:achieved']);
  });

  it('solo el hito más alto alcanzado', () => {
    const e = goalEvents(
      'u1',
      goal({ progress: { status: 'in_progress', progress: 0.8 } }),
      now,
    );
    expect(e.map((x) => x.dedupeKey)).toEqual(['goal:g1:m75']);
  });

  it('atrasada según la proyección, una vez por semana', () => {
    const e = goalEvents('u1', goal({ projection: { onTime: false } }), now);
    expect(e.map((x) => x.dedupeKey)).toEqual(['goal:g1:behind:2026-W43']);
  });

  it('las metas de precio no tienen hitos', () => {
    const e = goalEvents(
      'u1',
      goal({
        kind: 'target_price',
        progress: { status: 'in_progress', progress: 0.9 },
      }),
      now,
    );
    expect(e).toEqual([]);
  });
});

describe('compras periódicas', () => {
  const plan = (over: Partial<DcaForAlert>): DcaForAlert => ({
    id: 'p1',
    assetSymbol: 'BTC',
    amount: 50,
    frequency: 'weekly',
    startDate: '2026-10-07T00:00:00.000Z',
    endDate: null,
    isActive: true,
    ...over,
  });

  it('avisa el día que toca (cada 7 días desde el inicio)', () => {
    const n = dcaDueNotification('u1', plan({}), money, now);
    expect(n?.dedupeKey).toBe('dca:p1:2026-10-21');
    expect(n?.body).toContain('$50');
  });

  it('no avisa otros días, ni pausado, ni terminado', () => {
    expect(
      dcaDueNotification(
        'u1',
        plan({ startDate: '2026-10-08T00:00:00.000Z' }),
        money,
        now,
      ),
    ).toBeNull();
    expect(
      dcaDueNotification('u1', plan({ isActive: false }), money, now),
    ).toBeNull();
    expect(
      dcaDueNotification(
        'u1',
        plan({ endDate: '2026-10-15T00:00:00.000Z' }),
        money,
        now,
      ),
    ).toBeNull();
  });
});
