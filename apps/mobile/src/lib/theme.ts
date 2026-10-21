// Paletas de la app móvil. Cada una tiene modo claro (fondo suave, tarjetas
// blancas y tarjetas "destacadas" oscuras) y modo oscuro (lo inverso).
// Ganancia y pérdida conservan verde/rojo con contraste suficiente.
//
// El usuario elige la paleta en Ajustes → Preferencias (se guarda en el
// teléfono) y el modo claro/oscuro/del sistema (se guarda en su cuenta).
import { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';
import { useAppearance, type PaletteName } from '@/store/appearance';

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
  // Fondo de una tarjeta destacada cuando esta paleta es la invertida.
  | 'emphasis'
  | 'pnlUp'
  | 'pnlDown'
  | 'warning';

export type Palette = Record<PaletteKey, string>;

const GAIN_LOSS_LIGHT = { pnlUp: '#17784F', pnlDown: '#C2333F', warning: '#A86A12' };
const GAIN_LOSS_DARK = { pnlUp: '#7EE0A1', pnlDown: '#FF8F8F', warning: '#F2C46D' };

export const PALETTES: Record<PaletteName, { label: string; swatch: string[]; light: Palette; dark: Palette }> = {
  verde: {
    label: 'Verde',
    swatch: ['#051F20', '#163832', '#235347', '#8EB69B', '#DAF1DE'],
    light: {
      background: '#EEF6EF',
      surface: '#FFFFFF',
      surfaceRaised: '#DAF1DE',
      foreground: '#051F20',
      textSecondary: '#3D5A52',
      textMuted: '#6A857B',
      border: 'rgba(5, 31, 32, 0.08)',
      primary: '#235347',
      primarySoft: 'rgba(35, 83, 71, 0.12)',
      onPrimary: '#FFFFFF',
      accent: '#8EB69B',
      emphasis: '#DAF1DE',
      ...GAIN_LOSS_LIGHT,
    },
    dark: {
      background: '#051F20',
      surface: '#0B2B26',
      surfaceRaised: '#163832',
      foreground: '#DAF1DE',
      textSecondary: '#A9C8B4',
      textMuted: '#7A9C8B',
      border: 'rgba(218, 241, 222, 0.08)',
      primary: '#8EB69B',
      primarySoft: 'rgba(142, 182, 155, 0.16)',
      onPrimary: '#051F20',
      accent: '#8EB69B',
      emphasis: '#0B2B26',
      ...GAIN_LOSS_DARK,
    },
  },
  grafito: {
    label: 'Grafito',
    swatch: ['#0E0E10', '#3E3E45', '#63636E', '#9A9AA6', '#F2F2F5'],
    light: {
      background: '#F2F2F5',
      surface: '#FFFFFF',
      surfaceRaised: '#E4E4EA',
      foreground: '#0E0E10',
      textSecondary: '#3E3E45',
      textMuted: '#63636E',
      border: 'rgba(14, 14, 16, 0.08)',
      primary: '#232327',
      primarySoft: 'rgba(35, 35, 39, 0.1)',
      onPrimary: '#FFFFFF',
      accent: '#9A9AA6',
      emphasis: '#F2F2F5',
      ...GAIN_LOSS_LIGHT,
    },
    dark: {
      background: '#0E0E10',
      surface: '#232327',
      surfaceRaised: '#3E3E45',
      foreground: '#F2F2F5',
      textSecondary: '#C9C9D2',
      textMuted: '#9A9AA6',
      border: 'rgba(242, 242, 245, 0.08)',
      primary: '#C9C9D2',
      primarySoft: 'rgba(201, 201, 210, 0.14)',
      onPrimary: '#0E0E10',
      accent: '#63636E',
      emphasis: '#232327',
      ...GAIN_LOSS_DARK,
    },
  },
  cafe: {
    label: 'Café',
    swatch: ['#2A0800', '#775144', '#C09891', '#BEA8A7', '#F4DBD8'],
    light: {
      background: '#FBF1EF',
      surface: '#FFFFFF',
      surfaceRaised: '#F4DBD8',
      foreground: '#2A0800',
      textSecondary: '#5E3D32',
      textMuted: '#775144',
      border: 'rgba(42, 8, 0, 0.08)',
      primary: '#775144',
      primarySoft: 'rgba(119, 81, 68, 0.12)',
      onPrimary: '#FFFFFF',
      accent: '#C09891',
      emphasis: '#F4DBD8',
      ...GAIN_LOSS_LIGHT,
    },
    dark: {
      background: '#1F0600',
      surface: '#341710',
      surfaceRaised: '#4A2A20',
      foreground: '#F4DBD8',
      textSecondary: '#D9BDB8',
      textMuted: '#BEA8A7',
      border: 'rgba(244, 219, 216, 0.08)',
      primary: '#C09891',
      primarySoft: 'rgba(192, 152, 145, 0.16)',
      onPrimary: '#2A0800',
      accent: '#775144',
      emphasis: '#341710',
      ...GAIN_LOSS_DARK,
    },
  },
  pizarra: {
    label: 'Pizarra',
    swatch: ['#06141B', '#253745', '#4A5C6A', '#9BA8AB', '#CCD0CF'],
    light: {
      background: '#EDEFEF',
      surface: '#FFFFFF',
      surfaceRaised: '#DCE0DF',
      foreground: '#06141B',
      textSecondary: '#253745',
      textMuted: '#4A5C6A',
      border: 'rgba(6, 20, 27, 0.08)',
      primary: '#253745',
      primarySoft: 'rgba(37, 55, 69, 0.12)',
      onPrimary: '#FFFFFF',
      accent: '#9BA8AB',
      emphasis: '#CCD0CF',
      ...GAIN_LOSS_LIGHT,
    },
    dark: {
      background: '#06141B',
      surface: '#11212D',
      surfaceRaised: '#253745',
      foreground: '#CCD0CF',
      textSecondary: '#9BA8AB',
      textMuted: '#7D8D93',
      border: 'rgba(204, 208, 207, 0.08)',
      primary: '#9BA8AB',
      primarySoft: 'rgba(155, 168, 171, 0.16)',
      onPrimary: '#06141B',
      accent: '#4A5C6A',
      emphasis: '#11212D',
      ...GAIN_LOSS_DARK,
    },
  },
};

// Dentro de una tarjeta destacada (Card variant="inverse") todo usa la
// paleta opuesta: texto claro sobre fondo oscuro en modo claro, y al revés.
export const InvertContext = createContext(false);

export function usePalettes(): { base: Palette; inverse: Palette } {
  const isLight = useColorScheme() !== 'dark';
  const { light, dark } = PALETTES[useAppearance((s) => s.palette)];
  return isLight ? { base: light, inverse: dark } : { base: dark, inverse: light };
}

export function useTheme(): Palette {
  const inverted = useContext(InvertContext);
  const { base, inverse } = usePalettes();
  return inverted ? inverse : base;
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { sm: 10, md: 16, lg: 24, pill: 999 } as const;

// Paleta categórica para gráficos: tonos que se distinguen entre sí (no
// solo de la paleta base, para que se lean las series).
export const SERIES = ['#2F7A63', '#8EB69B', '#E0B15C', '#6C8EBF', '#C97B63', '#4FA3A5', '#9A7FC2', '#B8C46A'];

// Texto legible sobre un color (oscuro sobre tonos claros).
export function onColor(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#0E0E10' : '#FFFFFF';
}
