import { Appearance, Pressable, Text, useColorScheme, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Body, Card, Chip, Muted } from '@/components/ui';
import { PALETTES, radius, spacing, useTheme } from '@/lib/theme';
import { useAppearance, type PaletteName } from '@/store/appearance';

// TEMPORAL: para comparar paletas y modos en el teléfono. Quitar cuando se
// elija la definitiva.
export function PalettePicker() {
  const t = useTheme();
  const palette = useAppearance((s) => s.palette);
  const setPalette = useAppearance((s) => s.setPalette);
  const scheme = useColorScheme();

  return (
    <Card>
      <Body style={{ fontWeight: '700' }}>Paleta de colores (prueba)</Body>
      <Muted style={{ fontSize: 13 }}>Elegí una para verla en toda la app.</Muted>
      <View style={{ gap: spacing.sm }}>
        {(Object.keys(PALETTES) as PaletteName[]).map((name) => {
          const p = PALETTES[name];
          const selected = palette === name;
          return (
            <Pressable
              key={name}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`Paleta ${p.label}`}
              onPress={() => setPalette(name)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                padding: spacing.md,
                borderRadius: radius.md,
                borderWidth: 2,
                borderColor: selected ? t.foreground : t.border,
                backgroundColor: t.surface,
              }}
            >
              <View style={{ flexDirection: 'row' }}>
                {p.swatch.map((color, i) => (
                  <View
                    key={color}
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 13,
                      backgroundColor: color,
                      marginLeft: i === 0 ? 0 : -8,
                      borderWidth: 2,
                      borderColor: t.surface,
                    }}
                  />
                ))}
              </View>
              <Text style={{ color: t.foreground, fontSize: 15, fontWeight: selected ? '700' : '500', flex: 1 }}>
                {p.label}
              </Text>
              {selected ? <Ionicons name="checkmark-circle" size={22} color={t.foreground} /> : null}
            </Pressable>
          );
        })}
      </View>
      <Muted style={{ fontSize: 13, marginTop: spacing.xs }}>Modo</Muted>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Chip label="Claro" selected={scheme === 'light'} onPress={() => Appearance.setColorScheme('light')} />
        <Chip label="Oscuro" selected={scheme === 'dark'} onPress={() => Appearance.setColorScheme('dark')} />
        <Chip label="Del teléfono" selected={false} onPress={() => Appearance.setColorScheme('unspecified')} />
      </View>
    </Card>
  );
}
