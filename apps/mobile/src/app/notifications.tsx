import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { timeAgo, type AppNotification } from '@val-sistem/shared';
import { Button, Card, ErrorText, Loading, Muted, Screen } from '@/components/ui';
import { fetchNotifications, markNotificationsRead, notificationRoute } from '@/lib/alerts-clients';
import { spacing, useTheme } from '@/lib/theme';

// Centro de notificaciones: los avisos que llegaron, de más nuevo a más
// viejo. Tocar uno lo marca como leído y abre la pantalla relacionada.
export default function NotificationsScreen() {
  const t = useTheme();
  const queryClient = useQueryClient();
  const [now] = useState(() => Date.now());
  const list = useQuery({ queryKey: ['notifications'], queryFn: () => fetchNotifications(50) });
  const markRead = useMutation({
    mutationFn: markNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const open = (n: AppNotification) => {
    if (!n.read) markRead.mutate([n.id]);
    const route = notificationRoute(n.link);
    if (route) router.push(route);
  };

  return (
    <Screen onRefresh={() => void list.refetch()} refreshing={list.isRefetching}>
      {list.isLoading ? <Loading /> : null}
      {list.error && !list.data ? <ErrorText>{list.error.message}</ErrorText> : null}
      {list.data && list.data.unreadCount > 0 ? (
        <Button title="Marcar todas como leídas" variant="secondary" onPress={() => markRead.mutate(undefined)} />
      ) : null}
      {list.data?.items.length === 0 ? (
        <Card>
          <Muted>Todavía no recibiste avisos. Créalos en Plan → Avisos.</Muted>
        </Card>
      ) : null}
      {list.data && list.data.items.length > 0 ? (
        <Card style={{ gap: 0, paddingVertical: spacing.sm }}>
          {list.data.items.map((n, i) => (
            <Pressable
              key={n.id}
              accessibilityRole="button"
              accessibilityLabel={`${n.read ? '' : 'Sin leer. '}${n.title}. ${n.body}`}
              onPress={() => open(n)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                gap: spacing.md,
                paddingVertical: spacing.md,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: t.border,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  marginTop: 6,
                  backgroundColor: n.read ? 'transparent' : t.primary,
                }}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: n.read ? t.textSecondary : t.foreground, fontWeight: n.read ? '400' : '700', fontSize: 15 }}>
                  {n.title}
                </Text>
                <Muted style={{ fontSize: 13 }}>{n.body}</Muted>
                <Muted style={{ fontSize: 11 }}>{timeAgo(n.createdAt, now)}</Muted>
              </View>
            </Pressable>
          ))}
        </Card>
      ) : null}
      <Button title="Configurar avisos" variant="secondary" icon="settings-outline" onPress={() => router.push('/alerts')} />
    </Screen>
  );
}
