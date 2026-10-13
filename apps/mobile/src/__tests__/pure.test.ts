import type { Portfolio } from '@val-sistem/shared';
import { resolveApiUrl } from '@/lib/config';
import { describeAge } from '@/lib/staleness';
import { resolveActivePortfolio } from '@val-sistem/shared';

describe('resolveApiUrl', () => {
  it('usa EXPO_PUBLIC_API_URL sin barra final', () => {
    expect(resolveApiUrl('https://api.example.com/', 'x:8081')).toBe('https://api.example.com');
  });

  it('en desarrollo apunta al puerto 3000 de la máquina de expo start', () => {
    expect(resolveApiUrl(undefined, '192.168.1.10:8081')).toBe('http://192.168.1.10:3000');
  });

  it('sin hostUri cae a localhost', () => {
    expect(resolveApiUrl(undefined, undefined)).toBe('http://localhost:3000');
  });
});

describe('describeAge', () => {
  const now = Date.UTC(2026, 9, 12, 12, 0, 0);
  it.each([
    [0, 'sin datos guardados'],
    [now - 20_000, 'datos de hace instantes'],
    [now - 5 * 60_000, 'datos de hace 5 min'],
    [now - 3 * 3_600_000, 'datos de hace 3 h'],
    [now - 26 * 3_600_000, 'datos de hace 1 día'],
    [now - 72 * 3_600_000, 'datos de hace 3 días'],
  ])('%p -> %p', (updatedAt, expected) => {
    expect(describeAge(updatedAt, now)).toBe(expected);
  });
});

describe('resolveActivePortfolio', () => {
  const a: Portfolio = { id: 'a', name: 'A', isDefault: false, baseCurrency: 'USD' };
  const b: Portfolio = { id: 'b', name: 'B', isDefault: true, baseCurrency: 'USD' };

  it('sin elección usa el predeterminado', () => {
    expect(resolveActivePortfolio([a, b], null).portfolio?.id).toBe('b');
  });

  it('respeta la elección explícita', () => {
    expect(resolveActivePortfolio([a, b], 'a').portfolio?.id).toBe('a');
  });

  it('si la elección ya no existe cae al predeterminado', () => {
    expect(resolveActivePortfolio([a, b], 'borrado').portfolio?.id).toBe('b');
  });

  it('la vista General requiere 2 o más portafolios', () => {
    expect(resolveActivePortfolio([a, b], 'all')).toMatchObject({
      isAggregate: true,
      portfolio: { id: 'all', name: 'General (todos)' },
    });
    expect(resolveActivePortfolio([a], 'all')).toMatchObject({ isAggregate: false, portfolio: { id: 'a' } });
  });

  it('sin portafolios no hay activo', () => {
    expect(resolveActivePortfolio([], null).portfolio).toBeNull();
  });
});
