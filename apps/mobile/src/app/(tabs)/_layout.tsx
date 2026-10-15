import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';
import { useTheme } from '@/lib/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

function icon(name: IconName) {
  return function TabBarIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} color={color} size={size} />;
  };
}

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: t.primary,
        tabBarInactiveTintColor: t.textMuted,
        tabBarStyle: { backgroundColor: t.surface, borderTopColor: t.border },
        headerStyle: { backgroundColor: t.surface },
        headerTintColor: t.foreground,
        sceneStyle: { backgroundColor: t.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Inicio', tabBarIcon: icon('pie-chart-outline') }} />
      <Tabs.Screen name="positions" options={{ title: 'Posiciones', tabBarIcon: icon('layers-outline') }} />
      <Tabs.Screen
        name="transactions"
        options={{ title: 'Movimientos', tabBarIcon: icon('swap-horizontal-outline') }}
      />
      <Tabs.Screen name="plan" options={{ title: 'Plan', tabBarIcon: icon('compass-outline') }} />
      <Tabs.Screen name="settings" options={{ title: 'Ajustes', tabBarIcon: icon('settings-outline') }} />
    </Tabs>
  );
}
