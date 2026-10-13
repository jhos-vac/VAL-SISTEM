import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { Body, Card, Loading, Muted, Row, Screen } from '@/components/ui';
import { useActivePortfolio } from '@/hooks/useActivePortfolio';
import { ALL_PORTFOLIOS_ID } from '@val-sistem/shared';
import { useTheme } from '@/lib/theme';
import { usePortfolioSelection } from '@/store/portfolio';

export default function PortfoliosScreen() {
  const t = useTheme();
  const { portfolio, portfolios, canAggregate, isLoading } = useActivePortfolio();
  const setActive = usePortfolioSelection((s) => s.setActivePortfolioId);

  const options = [
    ...(canAggregate ? [{ id: ALL_PORTFOLIOS_ID, name: 'General (todos)', isDefault: false }] : []),
    ...portfolios,
  ];

  return (
    <Screen>
      {isLoading ? <Loading /> : null}
      {options.map((p) => {
        const selected = p.id === portfolio?.id;
        return (
          <Pressable
            key={p.id}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => {
              setActive(p.id);
              router.back();
            }}
          >
            <Card style={selected ? { borderColor: t.primary, borderWidth: 1 } : undefined}>
              <Row>
                <Body style={{ fontWeight: selected ? '600' : '400' }}>{p.name}</Body>
                {selected ? <Ionicons name="checkmark" size={20} color={t.primary} /> : null}
              </Row>
              {p.isDefault ? <Muted>Predeterminado</Muted> : null}
            </Card>
          </Pressable>
        );
      })}
      <Muted>Para crear o editar portafolios, usá la web.</Muted>
    </Screen>
  );
}
