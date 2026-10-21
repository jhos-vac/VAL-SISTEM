import { useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  alertRuleText,
  formatCurrency,
  NEW_ALERT_KIND_LABELS,
  type AlertsOverview,
  type NewAlertKind,
} from '@val-sistem/shared';
import { Body, Button, Card, Chip, ErrorText, Loading, Muted, Row, Screen, TextField } from '@/components/ui';
import { AssetSelector, SectionTitle } from '@/components/plan';
import { fetchPortfolios, fetchTickers } from '@/lib/clients';
import { createAlert, deleteAlert, fetchAlerts, setAutoAlert, updateAlert } from '@/lib/alerts-clients';
import { spacing, useTheme } from '@/lib/theme';

const money = (n: number) => formatCurrency(n, 'USD');
const KINDS: NewAlertKind[] = ['price', 'asset_move', 'portfolio_move', 'strategy_drift'];

// Avisos: crear (precio, movimientos, estrategia), prender o apagar, y los
// automáticos de metas y compras.
export default function AlertsScreen() {
  const t = useTheme();
  const params = useLocalSearchParams<{ asset?: string }>();
  const queryClient = useQueryClient();
  const alerts = useQuery({ queryKey: ['alerts'], queryFn: fetchAlerts });
  const setData = (o: AlertsOverview) => queryClient.setQueryData(['alerts'], o);
  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => updateAlert(id, { isActive }),
    onSuccess: setData,
  });
  const remove = useMutation({ mutationFn: deleteAlert, onSuccess: setData });
  const auto = useMutation({
    mutationFn: ({ kind, enabled }: { kind: 'goal_events' | 'dca_due'; enabled: boolean }) => setAutoAlert(kind, enabled),
    onSuccess: setData,
  });
  const [creating, setCreating] = useState(!!params.asset);
  const [created, setCreated] = useState<string | null>(null);

  return (
    <Screen onRefresh={() => void alerts.refetch()} refreshing={alerts.isRefetching}>
      <Muted style={{ fontSize: 13 }}>
        Llegan a la campana del Inicio y, con la app instalada como build propia, como notificación. Se revisan cada 5
        minutos.
      </Muted>
      {creating ? (
        <NewAlert
          initialAsset={params.asset ?? null}
          onDone={() => {
            setCreating(false);
            // La moneda precargada (desde Seguimiento) sirve una sola vez.
            if (params.asset) router.setParams({ asset: '' });
          }}
          onCreated={(o, text) => {
            setData(o);
            setCreated(text);
          }}
        />
      ) : (
        <>
          {created ? (
            <Card variant="mint">
              <Body style={{ fontWeight: '700' }}>Aviso creado</Body>
              <Muted>{created}</Muted>
            </Card>
          ) : null}
          <Button
            title={created ? 'Crear otro aviso' : 'Nuevo aviso'}
            icon="add"
            onPress={() => {
              setCreated(null);
              setCreating(true);
            }}
          />
        </>
      )}

      <SectionTitle>Tus avisos</SectionTitle>
      {alerts.isLoading ? <Loading /> : null}
      {alerts.error && !alerts.data ? <ErrorText>{alerts.error.message}</ErrorText> : null}
      {alerts.data?.rules.length === 0 ? (
        <Card>
          <Muted>Todavía no creaste avisos.</Muted>
        </Card>
      ) : null}
      {alerts.data?.rules.map((r) => (
        <Card key={r.id}>
          <Row>
            <Body style={{ flex: 1, color: r.isActive ? t.foreground : t.textMuted }}>{alertRuleText(r, money)}</Body>
            <Switch
              accessibilityLabel="Activo"
              value={r.isActive}
              onValueChange={(isActive) => toggle.mutate({ id: r.id, isActive })}
              trackColor={{ true: t.primary, false: t.surfaceRaised }}
            />
          </Row>
          <Row>
            <Muted style={{ fontSize: 12 }}>
              {r.lastTriggeredAt ? `Último aviso ${new Date(r.lastTriggeredAt).toLocaleString('es-EC')}` : 'Todavía no avisó'}
            </Muted>
            <Pressable accessibilityRole="button" accessibilityLabel="Eliminar aviso" onPress={() => remove.mutate(r.id)} hitSlop={8}>
              <Ionicons name="trash-outline" size={18} color={t.pnlDown} />
            </Pressable>
          </Row>
        </Card>
      ))}

      <SectionTitle>Automáticos</SectionTitle>
      <Card>
        <AutoRow
          title="Metas"
          description="Meta cumplida, hitos de 25/50/75 % o si vas atrasado."
          value={alerts.data?.auto.goalEvents ?? true}
          onChange={(enabled) => auto.mutate({ kind: 'goal_events', enabled })}
        />
        <View style={{ height: 1, backgroundColor: t.border }} />
        <AutoRow
          title="Compras periódicas"
          description="El día que toca una compra de tus planes."
          value={alerts.data?.auto.dcaDue ?? true}
          onChange={(enabled) => auto.mutate({ kind: 'dca_due', enabled })}
        />
      </Card>
    </Screen>
  );
}

function AutoRow({
  title,
  description,
  value,
  onChange,
}: {
  title: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const t = useTheme();
  return (
    <Row>
      <View style={{ flex: 1 }}>
        <Body style={{ fontWeight: '600' }}>{title}</Body>
        <Muted style={{ fontSize: 13 }}>{description}</Muted>
      </View>
      <Switch
        accessibilityLabel={title}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: t.primary, false: t.surfaceRaised }}
      />
    </Row>
  );
}

function NewAlert({
  initialAsset,
  onDone,
  onCreated,
}: {
  initialAsset: string | null;
  onDone: () => void;
  onCreated: (o: AlertsOverview, text: string) => void;
}) {
  const t = useTheme();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<NewAlertKind>('price');
  const [asset, setAsset] = useState<string | null>(initialAsset);
  const [portfolioId, setPortfolioId] = useState<string | null>(null);
  const [threshold, setThreshold] = useState('');
  const [repeat, setRepeat] = useState(false);
  const needsAsset = kind === 'price' || kind === 'asset_move';
  const needsPortfolio = kind === 'portfolio_move' || kind === 'strategy_drift';
  const tickers = useQuery({ queryKey: ['tickers'], queryFn: fetchTickers, enabled: kind === 'price' });
  const portfolios = useQuery({ queryKey: ['portfolios'], queryFn: fetchPortfolios });
  const price = asset ? tickers.data?.find((tk) => tk.assetSymbol === asset)?.price : undefined;
  const value = Number(threshold.trim().replace(',', '.'));
  const valid = value > 0 && (!needsAsset || !!asset) && (kind !== 'strategy_drift' || !!portfolioId);

  const create = useMutation({
    mutationFn: () =>
      createAlert({
        kind,
        threshold: value,
        ...(needsAsset ? { assetSymbol: asset! } : {}),
        ...(needsPortfolio && portfolioId ? { portfolioId } : {}),
        ...(kind === 'price' ? { repeat } : {}),
      }),
    onSuccess: (o) => {
      const before = new Set(
        (queryClient.getQueryData<AlertsOverview>(['alerts'])?.rules ?? []).map((r) => r.id),
      );
      const created = o.rules.find((r) => !before.has(r.id));
      onCreated(o, created ? alertRuleText(created, money) : 'Listo.');
      onDone();
    },
  });

  const presets =
    kind === 'price'
      ? price
        ? [-20, -10, 10, 20].map((p) => {
            const v = Number((price * (1 + p / 100)).toPrecision(5));
            return { label: `${p > 0 ? '+' : ''}${p}% · ${money(v)}`, value: v };
          })
        : []
      : kind === 'strategy_drift'
        ? [3, 5, 10].map((v) => ({ label: `${v} puntos`, value: v }))
        : [3, 5, 10].map((v) => ({ label: `±${v} %`, value: v }));

  return (
    <Card>
      <SectionTitle>Nuevo aviso</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {KINDS.map((k) => (
          <Chip
            key={k}
            label={NEW_ALERT_KIND_LABELS[k]}
            selected={kind === k}
            onPress={() => {
              setKind(k);
              setThreshold('');
            }}
          />
        ))}
      </View>

      {needsAsset ? (
        asset ? (
          <Row>
            <Body style={{ fontWeight: '700' }}>
              {asset}
              {price ? <Text style={{ color: t.textSecondary, fontWeight: '400' }}>  hoy {money(price)}</Text> : null}
            </Body>
            <Button title="Cambiar" variant="secondary" onPress={() => setAsset(null)} />
          </Row>
        ) : (
          <AssetSelector held={[]} exclude={[]} onPick={setAsset} />
        )
      ) : null}

      {needsPortfolio ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {kind === 'portfolio_move' ? (
            <Chip label="Todos" selected={portfolioId === null} onPress={() => setPortfolioId(null)} />
          ) : null}
          {(portfolios.data ?? []).map((p) => (
            <Chip key={p.id} label={p.name} selected={portfolioId === p.id} onPress={() => setPortfolioId(p.id)} />
          ))}
        </View>
      ) : null}

      <TextField
        label={
          kind === 'price'
            ? 'Avisarme cuando llegue a (USDT)'
            : kind === 'strategy_drift'
              ? 'Desvío máximo (puntos de %)'
              : 'Movimiento en 24 h (%)'
        }
        value={threshold}
        onChangeText={setThreshold}
        keyboardType="decimal-pad"
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {presets.map((p) => (
          <Chip key={p.label} label={p.label} selected={value === p.value} onPress={() => setThreshold(String(p.value))} />
        ))}
      </View>
      {kind === 'price' && price && value > 0 ? (
        <Muted style={{ fontSize: 13 }}>
          Te avisamos cuando {asset} {value > price ? 'suba' : 'baje'} hasta {money(value)} (
          {(((value - price) / price) * 100).toFixed(1)} % desde hoy).
        </Muted>
      ) : null}
      {kind === 'price' ? (
        <Row>
          <Muted style={{ flex: 1 }}>Avisarme cada vez que cruce ese precio</Muted>
          <Switch value={repeat} onValueChange={setRepeat} trackColor={{ true: t.primary, false: t.surfaceRaised }} />
        </Row>
      ) : null}

      {create.isError ? <ErrorText>{create.error.message}</ErrorText> : null}
      <Button title="Crear aviso" onPress={() => create.mutate()} disabled={!valid} loading={create.isPending} />
      <Button title="Cancelar" variant="secondary" onPress={onDone} />
    </Card>
  );
}
