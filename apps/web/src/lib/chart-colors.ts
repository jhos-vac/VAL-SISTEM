"use client";

import { useSyncExternalStore } from "react";

// Paleta "CryptoVault" (ver globals.css) duplicada aquí como hex literal
// porque recharts necesita valores de color reales en las props de sus
// componentes SVG (no puede resolver custom properties de CSS ahí). Los
// valores de esta paleta categórica y el azul secuencial son los mismos en
// claro y oscuro (globals.css no los sobreescribe en su bloque
// @media (prefers-color-scheme: light)), así que quedan como constantes.
export const CATEGORICAL = [
  "#3b82f6", // series-1 azul (marca)
  "#f5a623", // series-2 ámbar
  "#0ecb81", // series-3 verde
  "#a78bfa", // series-4 violeta
  "#f472b6", // series-5 magenta
  "#22d3ee", // series-6 cian
  "#fb923c", // series-7 naranja
  "#f6465d", // series-8 rojo
] as const;

export const SEQUENTIAL_BLUE = "#3b82f6";

// Ganancia/pérdida en texto (PnlValue.tsx) usa las clases Tailwind
// text-pnl-up/text-pnl-down, que ya resuelven --pnl-up/--pnl-down de
// globals.css y por lo tanto ya son claro/oscuro-conscientes vía CSS. Estas
// dos constantes quedan solo como referencia para el caso en que un chart
// SVG (no texto) necesite el mismo color de ganancia/pérdida.
export const GAIN = "#0ecb81";
export const LOSS = "#f6465d";

// Grid/eje/texto muted sí cambian entre modos (ver globals.css:
// --grid-hairline, --axis-baseline, --text-muted en :root vs. su bloque
// @media (prefers-color-scheme: light)) — estos valores tienen que
// duplicar exactamente los de allá.
const DARK_CHART_THEME = {
  gridHairline: "rgba(255, 255, 255, 0.06)",
  axisBaseline: "rgba(255, 255, 255, 0.14)",
  textMuted: "#64748b",
} as const;

const LIGHT_CHART_THEME = {
  gridHairline: "rgba(11, 14, 17, 0.08)",
  axisBaseline: "rgba(11, 14, 17, 0.16)",
  textMuted: "#8a93a6",
} as const;

export interface ChartTheme {
  gridHairline: string;
  axisBaseline: string;
  textMuted: string;
}

function getIsLightMode(): boolean {
  if (typeof window === "undefined") return false;
  // Si en el futuro se cablea el selector de tema de /settings a
  // document.documentElement.dataset.theme, que gane sobre la preferencia
  // del SO (mismo criterio que globals.css: :root:not([data-theme="dark"])
  // dentro de la media query de luz).
  const explicit = document.documentElement.dataset.theme;
  if (explicit === "light") return true;
  if (explicit === "dark") return false;
  return window.matchMedia("(prefers-color-scheme: light)").matches;
}

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const media = window.matchMedia("(prefers-color-scheme: light)");
  media.addEventListener("change", callback);
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => {
    media.removeEventListener("change", callback);
    observer.disconnect();
  };
}

// Hook reactivo: recharts pinta en SVG con props, no con CSS, así que los
// componentes de gráfico necesitan el hex resuelto en cada render en vez de
// depender de custom properties. Se re-renderiza solo si cambia el modo
// (preferencia del SO, o data-theme si algo lo setea).
export function useChartTheme(): ChartTheme {
  const isLight = useSyncExternalStore(
    subscribe,
    getIsLightMode,
    () => false, // snapshot de servidor: oscuro, coincide con el :root por defecto
  );
  return isLight ? LIGHT_CHART_THEME : DARK_CHART_THEME;
}
