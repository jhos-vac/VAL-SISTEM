import type { SyncStatus } from "@val-sistem/shared";

// RFC-03: cualquier pantalla que dependa de sincronización muestra su
// estado. Los colores de estado son fijos (nunca se reusan como
// categóricos) y siempre van con ícono + etiqueta, nunca solo color.
const STATUS_MAP: Record<SyncStatus, { label: string; className: string; icon: string }> = {
  pending: { label: "Pendiente", className: "text-status-warning", icon: "●" },
  running: { label: "Sincronizando", className: "text-primary", icon: "◐" },
  completed: { label: "Completada", className: "text-status-good", icon: "✓" },
  failed: { label: "Fallida", className: "text-status-critical", icon: "✕" },
};

export function SyncBadge({ status }: { status: SyncStatus }) {
  const meta = STATUS_MAP[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${meta.className}`}>
      <span aria-hidden="true">{meta.icon}</span>
      {meta.label}
    </span>
  );
}
