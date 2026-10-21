"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { timeAgo, type AppNotification } from "@val-sistem/shared";
import { IconBell } from "@/components/icons";
import { fetchNotifications, markNotificationsRead } from "@/lib/alerts-client";

// Campana de la barra superior: cantidad sin leer y los últimos avisos.
// Se actualiza sola cada minuto.
export function NotificationBell() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const ref = useRef<HTMLDivElement>(null);
  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetchNotifications(15),
    refetchInterval: 60_000,
  });
  const markRead = useMutation({
    mutationFn: markNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  // Cerrar al hacer clic afuera.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const unread = data?.unreadCount ?? 0;
  const openItem = (n: AppNotification) => {
    if (!n.read) markRead.mutate([n.id]);
    setOpen(false);
    if (n.link) router.push(n.link);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => {
          setNow(Date.now());
          setOpen((v) => !v);
        }}
        className="relative rounded-full p-2 text-text-secondary hover:bg-surface-raised hover:text-foreground"
        title="Notificaciones"
        aria-label={unread > 0 ? `Notificaciones: ${unread} sin leer` : "Notificaciones"}
        aria-expanded={open}
      >
        <IconBell />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-status-critical px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 top-11 z-20 w-80 overflow-hidden rounded-xl border border-border-hairline bg-surface shadow-lg">
          <div className="flex items-center justify-between border-b border-border-hairline px-3 py-2">
            <span className="text-sm font-semibold">Notificaciones</span>
            {unread > 0 ? (
              <button type="button" onClick={() => markRead.mutate(undefined)} className="text-xs text-primary">
                Marcar todas como leídas
              </button>
            ) : null}
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {!data || data.items.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-text-secondary">
                Sin avisos todavía. Crea uno en Avisos.
              </li>
            ) : (
              data.items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => openItem(n)}
                    className="flex w-full gap-2 px-3 py-2.5 text-left hover:bg-surface-raised"
                  >
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-primary"}`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm ${n.read ? "text-text-secondary" : "font-medium"}`}>{n.title}</span>
                      <span className="block text-xs text-text-muted">{n.body}</span>
                      <span className="block text-[11px] text-text-muted">{timeAgo(n.createdAt, now)}</span>
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
          <Link
            href="/alerts"
            onClick={() => setOpen(false)}
            className="block border-t border-border-hairline px-3 py-2 text-center text-xs text-primary hover:bg-surface-raised"
          >
            Configurar avisos
          </Link>
        </div>
      ) : null}
    </div>
  );
}
