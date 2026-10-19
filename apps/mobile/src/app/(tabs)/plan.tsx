import type { ComponentProps } from 'react';
import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import { MenuItem, Screen } from '@/components/ui';
import { PortfolioHeader } from '@/components/PortfolioHeader';
import { spacing } from '@/lib/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const ITEMS: { href: Href; icon: IconName; title: string; description: string }[] = [
  { href: '/review', icon: 'pulse-outline', title: 'Revisión', description: 'Cuánto subió o bajó cada moneda desde tu compra.' },
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
  return (
    <Screen>
      <PortfolioHeader />
      <View style={{ gap: spacing.sm }}>
        {ITEMS.map((item) => (
          <MenuItem
            key={item.title}
            icon={item.icon}
            title={item.title}
            description={item.description}
            onPress={() => router.push(item.href)}
          />
        ))}
      </View>
    </Screen>
  );
}
