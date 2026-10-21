import { useMemo, useState } from 'react';
import { Appearance, Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Chip, ErrorText, Loading, Muted, Screen, TextField } from '@/components/ui';
import { SectionTitle } from '@/components/plan';
import { PalettePicker } from '@/components/PalettePicker';
import {
  fetchSettings,
  fetchSettingsCatalogs,
  updateSettings,
  type ThemePreference,
  type UserSettings,
} from '@/lib/clients';
import { radius, spacing, useTheme } from '@/lib/theme';

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'Del teléfono' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
];

// Modo (claro, oscuro o del teléfono), colores, moneda, idioma y zona
// horaria. Cada cambio se guarda al tocarlo: el modo y lo demás en la cuenta
// (los comparte la web); los colores, en el teléfono.
export default function PreferencesScreen() {
  const t = useTheme();
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['user-settings'], queryFn: fetchSettings });
  const catalogs = useQuery({ queryKey: ['settings-catalogs'], queryFn: fetchSettingsCatalogs });
  const [tzSearch, setTzSearch] = useState('');

  const save = useMutation({
    mutationFn: updateSettings,
    onMutate: (input) => {
      const previous = queryClient.getQueryData<UserSettings>(['user-settings']);
      if (previous) queryClient.setQueryData(['user-settings'], { ...previous, ...input });
      if (input.theme) Appearance.setColorScheme(input.theme === 'system' ? 'unspecified' : input.theme);
      return { previous };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['user-settings'], ctx.previous);
    },
  });

  const timezones = useMemo(() => {
    const q = tzSearch.trim().toLowerCase();
    const all = catalogs.data?.timezones ?? [];
    return (q ? all.filter((z) => z.name.toLowerCase().includes(q)) : all).slice(0, 8);
  }, [catalogs.data, tzSearch]);

  if (settings.isLoading || catalogs.isLoading) return <Screen><Loading /></Screen>;
  const s = settings.data;
  if (!s || !catalogs.data) {
    return (
      <Screen>
        <ErrorText>{settings.error?.message ?? catalogs.error?.message ?? 'No se pudieron cargar tus preferencias.'}</ErrorText>
      </Screen>
    );
  }

  return (
    <Screen>
      <SectionTitle>Modo</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {THEMES.map((th) => (
          <Chip key={th.value} label={th.label} selected={s.theme === th.value} onPress={() => save.mutate({ theme: th.value })} />
        ))}
      </View>

      <SectionTitle>Colores</SectionTitle>
      <PalettePicker />

      <SectionTitle>Moneda</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {catalogs.data.currencies.map((c) => (
          <Chip key={c.code} label={`${c.code} ${c.symbol}`} selected={s.currency === c.code} onPress={() => save.mutate({ currency: c.code })} />
        ))}
      </View>

      <SectionTitle>Idioma</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {catalogs.data.languages.map((l) => (
          <Chip key={l.code} label={l.nativeName} selected={s.language === l.code} onPress={() => save.mutate({ language: l.code })} />
        ))}
      </View>

      <SectionTitle>Zona horaria</SectionTitle>
      <Muted style={{ fontSize: 13 }}>Actual: {s.timezone}</Muted>
      <TextField label="Buscar" value={tzSearch} onChangeText={setTzSearch} placeholder="Guayaquil, Madrid…" autoCorrect={false} />
      <View style={{ gap: spacing.xs }}>
        {timezones.map((z) => {
          const selected = s.timezone === z.name;
          return (
            <Pressable
              key={z.name}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => save.mutate({ timezone: z.name })}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: spacing.md,
                borderRadius: radius.md,
                backgroundColor: selected ? t.surfaceRaised : t.surface,
              }}
            >
              <Text style={{ color: t.foreground, flex: 1 }}>{z.name}</Text>
              <Muted style={{ fontSize: 12 }}>{z.utcOffset}</Muted>
              {selected ? <Ionicons name="checkmark" size={18} color={t.foreground} style={{ marginLeft: spacing.sm }} /> : null}
            </Pressable>
          );
        })}
      </View>
      {save.isError ? <ErrorText>{save.error.message}</ErrorText> : null}
    </Screen>
  );
}
