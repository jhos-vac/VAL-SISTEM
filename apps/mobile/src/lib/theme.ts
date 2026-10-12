// Misma paleta "CryptoVault" que la web (apps/web/src/app/globals.css):
// azul de marca, verde/rojo para ganancia/pérdida, dark-first.
import { useColorScheme } from 'react-native';

const dark = {
  background: '#0B0E11',
  surface: '#12161D',
  surfaceRaised: '#171C26',
  foreground: '#F5F7FA',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  border: 'rgba(255, 255, 255, 0.08)',
  primary: '#3B82F6',
  primarySoft: 'rgba(59, 130, 246, 0.12)',
  pnlUp: '#0ECB81',
  pnlDown: '#F6465D',
  warning: '#F5A623',
  onPrimary: '#FFFFFF',
};

export type Palette = typeof dark;

const light: Palette = {
  background: '#F7F8FA',
  surface: '#FFFFFF',
  surfaceRaised: '#F1F3F6',
  foreground: '#0B0E11',
  textSecondary: '#52596B',
  textMuted: '#8A93A6',
  border: 'rgba(11, 14, 17, 0.1)',
  primary: '#3B82F6',
  primarySoft: 'rgba(59, 130, 246, 0.1)',
  pnlUp: '#0A9D67',
  pnlDown: '#D92C47',
  warning: '#B7791F',
  onPrimary: '#FFFFFF',
};

export function useTheme(): Palette {
  return useColorScheme() === 'light' ? light : dark;
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { sm: 8, md: 12, lg: 16 } as const;
