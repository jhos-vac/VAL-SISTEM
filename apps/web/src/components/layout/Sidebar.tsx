"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconArrowsExchange,
  IconBank,
  IconGrid,
  IconList,
  IconPieChart,
  IconSettings,
  IconTrendingUp,
} from "@/components/icons";

const NAV_GROUPS = [
  {
    label: "Resumen",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: IconGrid },
      { href: "/portfolios", label: "Portafolios", icon: IconPieChart },
    ],
  },
  {
    label: "Activos",
    items: [
      { href: "/positions", label: "Posiciones", icon: IconList },
      { href: "/transactions", label: "Transacciones", icon: IconArrowsExchange },
      { href: "/market", label: "Mercado", icon: IconTrendingUp },
    ],
  },
  {
    label: "Cuenta",
    items: [
      { href: "/exchange", label: "Exchange", icon: IconBank },
      { href: "/settings", label: "Ajustes", icon: IconSettings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border-hairline bg-surface md:flex">
      <div className="flex items-center gap-2 px-5 py-5">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">
          V
        </span>
        <span className="font-[family-name:var(--font-heading)] text-[15px] font-bold tracking-tight">
          VAL-SISTEM
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 pb-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              {group.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                      active
                        ? "bg-primary-soft font-medium text-primary"
                        : "text-text-secondary hover:bg-surface-raised hover:text-foreground"
                    }`}
                  >
                    <Icon className="shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
