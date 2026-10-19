import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ALL_PORTFOLIOS_ID } from '@val-sistem/shared';
import { Avatar, Button, Card, Loading, Muted, Screen } from '@/components/ui';
import { useActivePortfolio } from '@/hooks/useActivePortfolio';
import { spacing, useTheme } from '@/lib/theme';
import { usePortfolioSelection } from '@/store/portfolio';

// Elegir el portafolio activo, crear uno nuevo o editar uno existente.
export default function PortfoliosScreen() {
  const t = useTheme();
  const { portfolio, portfolios, canAggregate, isLoading } = useActivePortfolio();
  const setActive = usePortfolioSelection((s) => s.setActivePortfolioId);

  const options = [
    ...(canAggregate ? [{ id: ALL_PORTFOLIOS_ID, name: 'General (todos)', isDefault: false, isPublic: false }] : []),
    ...portfolios,
  ];

  return (
    <Screen>
      {isLoading ? <Loading /> : null}
      {options.map((p) => {
        const selected = p.id === portfolio?.id;
        const editable = p.id !== ALL_PORTFOLIOS_ID;
        return (
          <Card key={p.id} style={selected ? { borderWidth: 2, borderColor: t.foreground } : undefined}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`Usar ${p.name}`}
                onPress={() => {
                  setActive(p.id);
                  router.back();
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 }}
              >
                <Avatar text={p.name} size={40} tone={selected ? 'solid' : 'mint'} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.foreground, fontSize: 16, fontWeight: selected ? '700' : '500' }}>
                    {p.name}
                  </Text>
                  <Muted style={{ fontSize: 12 }}>
                    {[
                      p.isDefault ? 'Predeterminado' : null,
                      p.isPublic ? 'Público en el ranking' : null,
                      !editable ? 'Suma todos tus portafolios' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Toca para usarlo'}
                  </Muted>
                </View>
                {selected ? <Ionicons name="checkmark-circle" size={22} color={t.foreground} /> : null}
              </Pressable>
              {editable ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Editar ${p.name}`}
                  onPress={() => router.push({ pathname: '/portfolio-edit', params: { id: p.id } })}
                  hitSlop={8}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: t.surfaceRaised,
                  }}
                >
                  <Ionicons name="create-outline" size={18} color={t.foreground} />
                </Pressable>
              ) : null}
            </View>
          </Card>
        );
      })}
      <Button title="Nuevo portafolio" icon="add" onPress={() => router.push('/portfolio-edit')} />
    </Screen>
  );
}
