// Paleta verde de la app móvil (#051F20 → #DAF1DE). Modo claro: fondo menta
// con tarjetas blancas y tarjetas "destacadas" verde noche; modo oscuro: lo
// inverso. Ganancia y pérdida conservan verde/rojo con contraste suficiente.
import { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';

export const GREEN = {
  night: '#051F20',
  forest: '#0B2B26',
  pine: '#163832',
  moss: '#235347',
  sage: '#8EB69B',
  mint: '#DAF1DE',
} as const;

type PaletteKey =
  | 'background'
  | 'surface'
  | 'surfaceRaised'
  | 'foreground'
  | 'textSecondary'
  | 'textMuted'
  | 'border'
  | 'primary'
  | 'primarySoft'
  | 'onPrimary'
  | 'accent'
  | 'emphasis'
  | 'tabBar'
  | 'pnlUp'
  | 'pnlDown'
  | 'warning';

const light: Record<PaletteKey, string> = {
  background: '#EEF6EF',
  surface: '#FFFFFF',
  surfaceRaised: GREEN.mint,
  foreground: GREEN.night,
  textSecondary: '#3D5A52',
  textMuted: '#6A857B',
  border: 'rgba(5, 31, 32, 0.08)',
  primary: GREEN.moss,
  primarySoft: 'rgba(35, 83, 71, 0.12)',
  onPrimary: '#FFFFFF',
  accent: GREEN.sage,
  // Fondo de una tarjeta destacada cuando esta paleta es la invertida.
  emphasis: GREEN.mint,
  tabBar: GREEN.night,
  pnlUp: '#17784F',
  pnlDown: '#C2333F',
  warning: '#A86A12',
};

export type Palette = typeof light;

const dark: Palette = {
  background: GREEN.night,
  surface: GREEN.forest,
  surfaceRaised: GREEN.pine,
  foreground: GREEN.mint,
  textSecondary: '#A9C8B4',
  textMuted: '#7A9C8B',
  border: 'rgba(218, 241, 222, 0.08)',
  primary: GREEN.sage,
  primarySoft: 'rgba(142, 182, 155, 0.16)',
  onPrimary: GREEN.night,
  accent: GREEN.sage,
  emphasis: GREEN.forest,
  tabBar: GREEN.forest,
  pnlUp: '#7EE0A1',
  pnlDown: '#FF8F8F',
  warning: '#F2C46D',
};

// Dentro de una tarjeta destacada (Card variant="inverse") todo usa la
// paleta opuesta: texto claro sobre verde noche en modo claro, y al revés.
export const InvertContext = createContext(false);

export function usePalettes(): { base: Palette; inverse: Palette } {
  const isLight = useColorScheme() !== 'dark';
  return isLight ? { base: light, inverse: dark } : { base: dark, inverse: light };
}

export function useTheme(): Palette {
  const inverted = useContext(InvertContext);
  const { base, inverse } = usePalettes();
  return inverted ? inverse : base;
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { sm: 10, md: 16, lg: 24, pill: 999 } as const;

// Paleta categórica para gráficos: arranca en verdes y sigue con tonos que
// se distinguen entre sí (no solo verdes, para que se lean las series).
export const SERIES = ['#2F7A63', '#8EB69B', '#E0B15C', '#6C8EBF', '#C97B63', '#4FA3A5', '#9A7FC2', '#B8C46A'];

// Texto legible sobre un color de la serie (oscuro sobre tonos claros).
export function onColor(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? GREEN.night : '#FFFFFF';
}
