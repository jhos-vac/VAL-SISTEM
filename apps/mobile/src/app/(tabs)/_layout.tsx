import { Tabs } from 'expo-router/js-tabs';
import { TabBar } from '@/components/TabBar';
import { useTheme } from '@/lib/theme';

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: t.background },
        headerShadowVisible: false,
        headerTintColor: t.foreground,
        headerTitleStyle: { fontWeight: '700', fontSize: 18 },
        headerTitleAlign: 'left',
        sceneStyle: { backgroundColor: t.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Inicio', headerShown: false }} />
      <Tabs.Screen name="positions" options={{ title: 'Posiciones' }} />
      <Tabs.Screen name="transactions" options={{ title: 'Movimientos' }} />
      <Tabs.Screen name="plan" options={{ title: 'Plan' }} />
      <Tabs.Screen name="settings" options={{ title: 'Ajustes' }} />
    </Tabs>
  );
}
