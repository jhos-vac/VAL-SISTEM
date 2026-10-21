import {
  computeGoalProgress,
  goalHistory,
  priceSeries,
  priceDirectionFor,
  projectGoal,
  type GoalContext,
  type GoalDefinition,
} from './goals';

const now = new Date(Date.UTC(2026, 9, 14));
const inDays = (d: number) => new Date(now.getTime() + d * 86_400_000);

const base: GoalDefinition = {
  kind: 'target_value',
  targetValue: null,
  targetPercent: null,
  targetQuantity: null,
  targetPrice: null,
  priceDirection: null,
  deadline: null,
  completedAt: null,
};
// Contexto con los campos de activo en 0 (metas de portafolio).
const ctx = (c: Omit<GoalContext, 'quantity' | 'price'>): GoalContext => ({
  quantity: 0,
  price: 0,
  ...c,
});

const valueGoal = (
  targetValue: number,
  deadline: Date | null = null,
): GoalDefinition => ({ ...base, kind: 'target_value', targetValue, deadline });
const percentGoal = (targetPercent: number): GoalDefinition => ({
  ...base,
  kind: 'gain_percent',
  targetPercent,
});

describe('computeGoalProgress — valor objetivo', () => {
  it('progreso, faltante y ritmo mensual hasta la fecha', () => {
    const p = computeGoalProgress(
      valueGoal(10_000, inDays(61)),
      ctx({
        now,
        currentValue: 7_000,
        invested: 6_000,
        gain: 1_000,
      }),
    );
    expect(p.status).toBe('in_progress');
    expect(p.progress).toBeCloseTo(0.7);
    expect(p.remainingValue).toBe(3_000);
    expect(p.daysLeft).toBe(61);
    // 3.000 en ~2 meses
    expect(p.neededPerMonth).toBeCloseTo(3_000 / (61 / 30.44));
  });

  it('cumplida: progreso 1 y nada pendiente', () => {
    const p = computeGoalProgress(
      valueGoal(5_000),
      ctx({
        now,
        currentValue: 5_500,
        invested: 4_000,
        gain: 1_500,
      }),
    );
    expect(p).toMatchObject({
      status: 'achieved',
      progress: 1,
      remainingValue: 0,
      neededPerMonth: null,
    });
  });

  it('vencida si pasó la fecha sin cumplirse', () => {
    const p = computeGoalProgress(
      valueGoal(10_000, inDays(-1)),
      ctx({
        now,
        currentValue: 9_000,
        invested: 8_000,
        gain: 1_000,
      }),
    );
    expect(p.status).toBe('expired');
    expect(p.neededPerMonth).toBeNull();
  });
});

describe('computeGoalProgress — % de ganancia', () => {
  it('+10 %: compara la ganancia sobre lo invertido', () => {
    const p = computeGoalProgress(
      percentGoal(10),
      ctx({
        now,
        currentValue: 1_050,
        invested: 1_000,
        gain: 50,
      }),
    );
    expect(p.current).toBeCloseTo(5);
    expect(p.progress).toBeCloseTo(0.5);
    // Para +10 % el valor tendría que llegar a 1.100.
    expect(p.targetValueEquivalent).toBeCloseTo(1_100);
    expect(p.remainingValue).toBeCloseTo(50);
  });

  it('con pérdidas el progreso es 0, no negativo', () => {
    const p = computeGoalProgress(
      percentGoal(10),
      ctx({
        now,
        currentValue: 900,
        invested: 1_000,
        gain: -100,
      }),
    );
    expect(p.progress).toBe(0);
    expect(p.status).toBe('in_progress');
  });

  it('sin nada invertido no se considera cumplida', () => {
    const p = computeGoalProgress(
      percentGoal(10),
      ctx({
        now,
        currentValue: 0,
        invested: 0,
        gain: 0,
      }),
    );
    expect(p.status).toBe('in_progress');
  });

  it('cumplida al superar el %', () => {
    const p = computeGoalProgress(
      percentGoal(10),
      ctx({
        now,
        currentValue: 1_200,
        invested: 1_000,
        gain: 200,
      }),
    );
    expect(p.status).toBe('achieved');
  });
});

describe('computeGoalProgress — cantidad de una moneda', () => {
  const goal: GoalDefinition = {
    ...base,
    kind: 'asset_quantity',
    targetQuantity: 0.5,
  };

  it('compara lo que se tiene con la cantidad objetivo y valora lo que falta', () => {
    const p = computeGoalProgress(goal, {
      now,
      currentValue: 20_000,
      invested: 15_000,
      gain: 5_000,
      quantity: 0.2,
      price: 100_000,
    });
    expect(p.progress).toBeCloseTo(0.4);
    expect(p.current).toBe(0.2);
    expect(p.targetValueEquivalent).toBe(50_000);
    expect(p.remainingValue).toBe(30_000);
  });

  it('cumplida al llegar a la cantidad', () => {
    const p = computeGoalProgress(goal, {
      now,
      currentValue: 0,
      invested: 0,
      gain: 0,
      quantity: 0.5,
      price: 1,
    });
    expect(p.status).toBe('achieved');
  });
});

describe('computeGoalProgress — precio objetivo', () => {
  const asset = { now, currentValue: 0, invested: 0, gain: 0, quantity: 2 };

  it('la dirección sale del precio al crearla', () => {
    expect(priceDirectionFor(3_000, 4_000)).toBe('above');
    expect(priceDirectionFor(5_000, 4_000)).toBe('below');
  });

  it('hacia arriba: progreso y cumplida al tocar el precio', () => {
    const goal: GoalDefinition = {
      ...base,
      kind: 'target_price',
      targetPrice: 4_000,
      priceDirection: 'above',
    };
    expect(
      computeGoalProgress(goal, { ...asset, price: 3_000 }).progress,
    ).toBeCloseTo(0.75);
    expect(computeGoalProgress(goal, { ...asset, price: 4_100 }).status).toBe(
      'achieved',
    );
  });

  it('hacia abajo: cumplida al bajar hasta el precio', () => {
    const goal: GoalDefinition = {
      ...base,
      kind: 'target_price',
      targetPrice: 4_000,
      priceDirection: 'below',
    };
    const p = computeGoalProgress(goal, { ...asset, price: 5_000 });
    expect(p.progress).toBeCloseTo(0.8);
    expect(p.status).toBe('in_progress');
    expect(computeGoalProgress(goal, { ...asset, price: 3_900 }).status).toBe(
      'achieved',
    );
  });

  it('una vez tocado el precio queda cumplida aunque vuelva', () => {
    const goal: GoalDefinition = {
      ...base,
      kind: 'target_price',
      targetPrice: 4_000,
      priceDirection: 'above',
      completedAt: inDays(-3),
    };
    expect(computeGoalProgress(goal, { ...asset, price: 3_500 }).status).toBe(
      'achieved',
    );
  });
});

describe('projectGoal', () => {
  // Valor que sube 100 por día durante 30 días: de 1.000 a 4.000.
  const series = Array.from({ length: 31 }, (_, i) => ({
    date: inDays(i - 30),
    value: 1_000 + i * 100,
  }));

  it('estima la fecha con el ritmo de los últimos días', () => {
    const p = projectGoal(series, 4_000, 7_000, now, null)!;
    expect(p.perMonth).toBeCloseTo(3_044);
    expect(new Date(p.etaDate!).getTime()).toBe(inDays(30).getTime());
    expect(p.onTime).toBeNull();
  });

  it('dice si llega a tiempo para la fecha límite', () => {
    expect(projectGoal(series, 4_000, 7_000, now, inDays(40))!.onTime).toBe(
      true,
    );
    expect(projectGoal(series, 4_000, 7_000, now, inDays(20))!.onTime).toBe(
      false,
    );
  });

  it('si no avanza no hay fecha estimada', () => {
    const flat = series.map((p) => ({ ...p, value: 1_000 }));
    const p = projectGoal(flat, 1_000, 2_000, now, inDays(10))!;
    expect(p.etaDate).toBeNull();
    expect(p.onTime).toBe(false);
  });

  it('sin una semana de historia no proyecta', () => {
    expect(projectGoal(series.slice(-3), 4_000, 7_000, now, null)).toBeNull();
  });
});

describe('historia del gráfico', () => {
  it('precio por día = valor / cantidad, solo los días con cantidad', () => {
    const values = [
      { date: inDays(-2), value: 200 },
      { date: inDays(-1), value: 0 },
    ];
    const qty = [
      { date: inDays(-2), value: 2 },
      { date: inDays(-1), value: 0 },
    ];
    expect(priceSeries(values, qty)).toEqual([
      { date: inDays(-2), value: 100 },
    ]);
  });

  it('termina con el valor de hoy (reemplaza el snapshot del día)', () => {
    const h = goalHistory(
      [
        { date: inDays(-1), value: 10 },
        { date: now, value: 11 },
      ],
      12,
      now,
    );
    expect(h).toEqual([
      { date: inDays(-1).toISOString().slice(0, 10), value: 10 },
      { date: now.toISOString().slice(0, 10), value: 12 },
    ]);
  });
});
