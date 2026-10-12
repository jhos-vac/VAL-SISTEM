import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useOnline } from '@/hooks/useOnline';
import { describeAge } from '@/lib/staleness';
import { spacing, useTheme } from '@/lib/theme';

// Modo offline mínimo: sin conexión se siguen mostrando los últimos datos
// guardados, con este aviso de cuán viejos son.
export function OfflineBanner() {
  const online = useOnline();
  const queryClient = useQueryClient();
  const t = useTheme();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (online) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [online]);

  if (online) return null;

  const lastUpdated = Math.max(
    0,
    ...queryClient
      .getQueryCache()
      .getAll()
      .map((q) => q.state.dataUpdatedAt),
  );

  return (
    <View
      accessibilityRole="alert"
      style={{ backgroundColor: t.warning, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg }}
    >
      <Text style={{ color: '#0B0E11', fontSize: 13, fontWeight: '600' }}>
        Sin conexión · {describeAge(lastUpdated, now)}
      </Text>
    </View>
  );
}
