import type { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import { Muted, Screen } from '@/components/ui';
import { PortfolioHeader } from '@/components/PortfolioHeader';
import { radius, spacing, useTheme } from '@/lib/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const ITEMS: { href: Href; icon: IconName; title: string; description: string }[] = [
  { href: '/goals', icon: 'flag-outline', title: 'Metas', description: 'Valor o % de ganancia a alcanzar, con su progreso.' },
  { href: '/strategy', icon: 'compass-outline', title: 'Estrategia', description: 'Qué % querés en cada activo y qué comprar o vender.' },
  { href: '/dca', icon: 'repeat-outline', title: 'Compras periódicas', description: 'Planes DCA: lo planeado contra lo comprado.' },
  { href: '/lots', icon: 'layers-outline', title: 'Rendimiento por compra', description: 'Cada compra con su precio y su ganancia.' },
  { href: '/explore', icon: 'people-outline', title: 'Explorar portafolios', description: 'Los que más rinden; copiá su composición.' },
  { href: '/market', icon: 'trending-up-outline', title: 'Mercado', description: 'Precios y variación 24 h.' },
];

// Pestaña de planificación: acceso a metas, estrategia, DCA, compras,
// ranking público y mercado.
export default function PlanScreen() {
  const t = useTheme();
  return (
    <Screen>
      <PortfolioHeader />
      <View style={{ gap: spacing.md }}>
        {ITEMS.map((item) => (
          <Pressable
            key={item.title}
            accessibilityRole="button"
            onPress={() => router.push(item.href)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              padding: spacing.lg,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: t.border,
              backgroundColor: pressed ? t.surfaceRaised : t.surface,
            })}
          >
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={item.icon} size={22} color={t.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.foreground, fontSize: 16, fontWeight: '600' }}>{item.title}</Text>
              <Muted style={{ fontSize: 13 }}>{item.description}</Muted>
            </View>
            <Ionicons name="chevron-forward" size={18} color={t.textMuted} />
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
