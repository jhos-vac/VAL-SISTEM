import type { TransactionType } from '@val-sistem/shared';

export const TYPE_LABELS: Record<TransactionType, string> = {
  buy: 'Compra',
  sell: 'Venta',
  transfer_in: 'Entrada',
  transfer_out: 'Salida',
};
