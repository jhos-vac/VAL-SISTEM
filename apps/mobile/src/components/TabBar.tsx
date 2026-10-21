import type { ComponentProps } from 'react';
import { Pressable, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Tabs } from 'expo-router/js-tabs';
import { radius, spacing, useTheme } from '@/lib/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];
type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

export const TAB_ICONS: Record<string, { icon: IconName; active: IconName }> = {
  index: { icon: 'home-outline', active: 'home' },
  positions: { icon: 'layers-outline', active: 'layers' },
  transactions: { icon: 'swap-horizontal-outline', active: 'swap-horizontal' },
  plan: { icon: 'compass-outline', active: 'compass' },
  settings: { icon: 'person-outline', active: 'person' },
};

// Barra de pestañas flotante. Sigue al modo: en claro es una pastilla clara
// con la pestaña activa en un círculo oscuro; en oscuro, al revés.
export function TabBar({ state, descriptors, navigation, insets }: TabBarProps) {
  const t = useTheme();
  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: Math.max(insets.bottom, spacing.md) }}
    >
      <View
        accessibilityRole="tablist"
        style={{
          marginHorizontal: spacing.xl,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: t.surface,
          borderWidth: 1,
          borderColor: t.border,
          borderRadius: radius.pill,
          padding: spacing.sm,
          shadowColor: '#000',
          shadowOpacity: 0.18,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
          elevation: 10,
        }}
      >
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const { options } = descriptors[route.key]!;
          const icons = TAB_ICONS[route.name] ?? { icon: 'ellipse-outline', active: 'ellipse' };
          const label = typeof options.title === 'string' ? options.title : route.name;
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: focused ? t.foreground : 'transparent',
              }}
            >
              <Ionicons
                name={focused ? icons.active : icons.icon}
                size={22}
                color={focused ? t.background : t.textMuted}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
