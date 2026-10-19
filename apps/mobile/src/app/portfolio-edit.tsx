import { useState } from 'react';
import { Switch, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Portfolio } from '@val-sistem/shared';
import { Body, Button, Card, Chip, ErrorText, Muted, Row, Screen, TextField } from '@/components/ui';
import { SectionTitle } from '@/components/plan';
import { useActivePortfolio } from '@/hooks/useActivePortfolio';
import { createPortfolio, setPublication, updatePortfolio } from '@/lib/clients';
import { spacing, useTheme } from '@/lib/theme';
import { usePortfolioSelection } from '@/store/portfolio';

const CURRENCIES = ['USD', 'EUR', 'USDT'];

// Crear (sin id) o editar un portafolio, y publicarlo en el ranking.
export default function PortfolioEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { portfolios } = useActivePortfolio();
  const existing = id ? portfolios.find((p) => p.id === id) : undefined;
  if (id && !existing) {
    return (
      <Screen>
        <Muted>No se encontró el portafolio.</Muted>
      </Screen>
    );
  }
  return <PortfolioForm key={existing?.id ?? 'new'} existing={existing} />;
}

function PortfolioForm({ existing }: { existing?: Portfolio }) {
  const t = useTheme();
  const queryClient = useQueryClient();
  const setActive = usePortfolioSelection((s) => s.setActivePortfolioId);
  const [name, setName] = useState(existing?.name ?? '');
  const [currency, setCurrency] = useState<string>(existing?.baseCurrency ?? 'USD');
  const [isDefault, setIsDefault] = useState(existing?.isDefault ?? false);

  const save = useMutation({
    mutationFn: () => {
      const input = { name: name.trim(), baseCurrency: currency.trim().toUpperCase() };
      if (!existing) return createPortfolio({ ...input, isDefault });
      return updatePortfolio(existing.id, { ...input, ...(isDefault && !existing.isDefault ? { isDefault: true } : {}) });
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ['portfolios'] });
      if (!existing) setActive(saved.id);
      router.back();
    },
  });

  const valid = name.trim().length >= 2 && currency.trim().length >= 3;

  return (
    <Screen>
      <TextField label="Nombre" value={name} onChangeText={setName} placeholder="Largo plazo" maxLength={80} />

      <SectionTitle>Moneda base</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {CURRENCIES.map((c) => (
          <Chip key={c} label={c} selected={currency === c} onPress={() => setCurrency(c)} />
        ))}
      </View>
      {!CURRENCIES.includes(currency) ? (
        <TextField label="Otra moneda (código)" value={currency} onChangeText={setCurrency} autoCapitalize="characters" maxLength={10} />
      ) : (
        <Muted style={{ fontSize: 13 }} >
          Los valores del portafolio se muestran en esta moneda.
        </Muted>
      )}

      <Card>
        <Row>
          <View style={{ flex: 1 }}>
            <Body style={{ fontWeight: '600' }}>Predeterminado</Body>
            <Muted style={{ fontSize: 13 }}>Es el que se abre primero y donde caen las compras sin portafolio.</Muted>
          </View>
          <Switch
            accessibilityLabel="Portafolio predeterminado"
            value={isDefault}
            onValueChange={setIsDefault}
            disabled={existing?.isDefault}
            trackColor={{ true: t.primary, false: t.surfaceRaised }}
          />
        </Row>
      </Card>

      {save.isError ? <ErrorText>{save.error.message}</ErrorText> : null}
      <Button
        title={existing ? 'Guardar cambios' : 'Crear portafolio'}
        onPress={() => save.mutate()}
        disabled={!valid}
        loading={save.isPending}
      />

      {existing ? <PublishCard portfolio={existing} /> : null}
    </Screen>
  );
}

// Publicar en el ranking de Explorar (opt-in) con un alias.
function PublishCard({ portfolio }: { portfolio: Portfolio }) {
  const queryClient = useQueryClient();
  const [alias, setAlias] = useState(portfolio.publicAlias ?? portfolio.name);
  const publish = useMutation({
    mutationFn: (isPublic: boolean) =>
      setPublication(portfolio.id, isPublic ? { isPublic, alias: alias.trim() } : { isPublic }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['portfolios'] });
      await queryClient.invalidateQueries({ queryKey: ['public-ranking'] });
    },
  });

  return (
    <Card variant="mint">
      <Body style={{ fontWeight: '700' }}>Ranking público</Body>
      {portfolio.isPublic ? (
        <>
          <Muted>Publicado como “{portfolio.publicAlias}”. Otros ven su rendimiento y su composición en Explorar.</Muted>
          <Button title="Dejar de publicar" variant="secondary" onPress={() => publish.mutate(false)} loading={publish.isPending} />
        </>
      ) : (
        <>
          <Muted>
            Otros usuarios verán el % de rendimiento y qué % tiene cada activo. Nunca montos, cantidades, tu usuario ni tu
            email.
          </Muted>
          <TextField label="Alias público" value={alias} onChangeText={setAlias} maxLength={40} />
          <Button
            title="Publicar en el ranking"
            icon="trophy-outline"
            onPress={() => publish.mutate(true)}
            disabled={alias.trim().length < 3}
            loading={publish.isPending}
          />
        </>
      )}
      {publish.isError ? <ErrorText>{publish.error.message}</ErrorText> : null}
    </Card>
  );
}
