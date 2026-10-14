import { computeGoalProgress, type GoalDefinition } from './goals';

const now = new Date(Date.UTC(2026, 9, 14));
const inDays = (d: number) => new Date(now.getTime() + d * 86_400_000);

const valueGoal = (
  targetValue: number,
  deadline: Date | null = null,
): GoalDefinition => ({
  kind: 'target_value',
  targetValue,
  targetPercent: null,
  deadline,
});
const percentGoal = (targetPercent: number): GoalDefinition => ({
  kind: 'gain_percent',
  targetValue: null,
  targetPercent,
  deadline: null,
});

describe('computeGoalProgress — valor objetivo', () => {
  it('progreso, faltante y ritmo mensual hasta la fecha', () => {
    const p = computeGoalProgress(valueGoal(10_000, inDays(61)), {
      now,
      currentValue: 7_000,
      invested: 6_000,
      gain: 1_000,
    });
    expect(p.status).toBe('in_progress');
    expect(p.progress).toBeCloseTo(0.7);
    expect(p.remainingValue).toBe(3_000);
    expect(p.daysLeft).toBe(61);
    // 3.000 en ~2 meses
    expect(p.neededPerMonth).toBeCloseTo(3_000 / (61 / 30.44));
  });

  it('cumplida: progreso 1 y nada pendiente', () => {
    const p = computeGoalProgress(valueGoal(5_000), {
      now,
      currentValue: 5_500,
      invested: 4_000,
      gain: 1_500,
    });
    expect(p).toMatchObject({
      status: 'achieved',
      progress: 1,
      remainingValue: 0,
      neededPerMonth: null,
    });
  });

  it('vencida si pasó la fecha sin cumplirse', () => {
    const p = computeGoalProgress(valueGoal(10_000, inDays(-1)), {
      now,
      currentValue: 9_000,
      invested: 8_000,
      gain: 1_000,
    });
    expect(p.status).toBe('expired');
    expect(p.neededPerMonth).toBeNull();
  });
});

describe('computeGoalProgress — % de ganancia', () => {
  it('+10 %: compara la ganancia sobre lo invertido', () => {
    const p = computeGoalProgress(percentGoal(10), {
      now,
      currentValue: 1_050,
      invested: 1_000,
      gain: 50,
    });
    expect(p.current).toBeCloseTo(5);
    expect(p.progress).toBeCloseTo(0.5);
    // Para +10 % el valor tendría que llegar a 1.100.
    expect(p.targetValueEquivalent).toBeCloseTo(1_100);
    expect(p.remainingValue).toBeCloseTo(50);
  });

  it('con pérdidas el progreso es 0, no negativo', () => {
    const p = computeGoalProgress(percentGoal(10), {
      now,
      currentValue: 900,
      invested: 1_000,
      gain: -100,
    });
    expect(p.progress).toBe(0);
    expect(p.status).toBe('in_progress');
  });

  it('sin nada invertido no se considera cumplida', () => {
    const p = computeGoalProgress(percentGoal(10), {
      now,
      currentValue: 0,
      invested: 0,
      gain: 0,
    });
    expect(p.status).toBe('in_progress');
  });

  it('cumplida al superar el %', () => {
    const p = computeGoalProgress(percentGoal(10), {
      now,
      currentValue: 1_200,
      invested: 1_000,
      gain: 200,
    });
    expect(p.status).toBe('achieved');
  });
});
