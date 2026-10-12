// Texto del aviso "datos desactualizados" del modo offline.
export function describeAge(updatedAt: number, now: number): string {
  if (!updatedAt) return 'sin datos guardados';
  const minutes = Math.floor((now - updatedAt) / 60_000);
  if (minutes < 1) return 'datos de hace instantes';
  if (minutes < 60) return `datos de hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `datos de hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `datos de hace ${days} ${days === 1 ? 'día' : 'días'}`;
}
