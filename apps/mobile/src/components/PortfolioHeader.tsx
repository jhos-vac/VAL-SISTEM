import { Pressable, Text } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useActivePortfolio } from '@/hooks/useActivePortfolio';
import { spacing, useTheme } from '@/lib/theme';

// Selector del portafolio activo, arriba de cada pantalla con datos.
export function PortfolioHeader() {
  const t = useTheme();
  const { portfolio } = useActivePortfolio();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Portafolio activo: ${portfolio?.name ?? 'ninguno'}. Cambiar`}
      onPress={() => router.push('/portfolios')}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 44 }}
    >
      <Text style={{ color: t.foreground, fontSize: 22, fontWeight: '700' }} numberOfLines={1}>
        {portfolio?.name ?? 'Portafolio'}
      </Text>
      <Ionicons name="chevron-down" size={18} color={t.textSecondary} />
    </Pressable>
  );
}
