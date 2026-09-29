// Utilidades de formato compartidas (RFC-01: cifras siempre en la moneda
// base del portafolio, con formato localizado).

export function formatCurrency(
  value: number,
  currency: string = 'USD',
  locale: string = 'es-EC'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: value !== 0 && Math.abs(value) < 1 ? 6 : 2,
  }).format(value);
}

export function formatPercent(value: number, locale: string = 'es-EC'): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
  }).format(value)}%`;
}

export function formatQuantity(value: number, maxDecimals: number = 8): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: maxDecimals,
  }).format(value);
}

export function maskApiKey(last4: string): string {
  return `•••• ${last4}`;
}
