"use client";

// Controles de elección rápida, reutilizados en formularios interactivos.

// Grupo segmentado (una opción activa), accesible como radiogroup.
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Array<{ value: T; label: string; hint?: string }>;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-lg bg-surface-raised p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            title={o.hint}
            className={`rounded-md px-3 py-1.5 text-sm transition-all ${
              active ? "bg-primary text-white shadow-sm" : "text-text-secondary hover:text-foreground"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// Chip de atajo (completa un valor con un clic).
export function Chip({
  active = false,
  onClick,
  children,
  disabled = false,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "border-primary bg-primary-soft text-primary"
          : "border-border-hairline text-text-secondary hover:border-primary hover:text-primary"
      }`}
    >
      {children}
    </button>
  );
}

// Tarjeta seleccionable grande (para elegir un tipo con descripción).
export function OptionCard({
  active,
  onClick,
  title,
  description,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`flex-1 rounded-xl border p-3 text-left transition-all ${
        active
          ? "border-primary bg-primary-soft ring-1 ring-primary"
          : "border-border-hairline hover:border-primary/50"
      }`}
    >
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-0.5 text-xs text-text-secondary">{description}</p>
    </button>
  );
}
