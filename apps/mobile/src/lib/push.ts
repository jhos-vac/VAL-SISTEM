// Registro del dispositivo para notificaciones push. El envío real de
// alertas depende del módulo Automation del backend (todavía sin código);
// esto deja el push token registrado en /devices para cuando exista.
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { APP_VERSION, EAS_PROJECT_ID } from './config';
import { registerDevice } from './clients';
import { secure } from './secure';

Notifications.setNotificationHandler({
  handleNotification: () =>
    Promise.resolve({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
});

export type PushRegistration =
  | { status: 'registered'; deviceId: string }
  | { status: 'skipped'; reason: string };

export async function registerForPush(): Promise<PushRegistration> {
  if (!Device.isDevice) {
    return { status: 'skipped', reason: 'Push solo funciona en un dispositivo físico' };
  }
  if (!EAS_PROJECT_ID) {
    return { status: 'skipped', reason: 'Falta el projectId de EAS (npx eas-cli init)' };
  }
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return { status: 'skipped', reason: 'Plataforma sin push' };
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'General',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const current = await Notifications.getPermissionsAsync();
  const finalStatus =
    current.status === 'granted'
      ? current.status
      : (await Notifications.requestPermissionsAsync()).status;
  if (finalStatus !== 'granted') {
    return { status: 'skipped', reason: 'Permiso de notificaciones denegado' };
  }

  const { data: pushToken } = await Notifications.getExpoPushTokenAsync({
    projectId: EAS_PROJECT_ID,
  });
  const device = await registerDevice({
    deviceName: Device.deviceName ?? Device.modelName ?? 'Teléfono',
    platform: Platform.OS,
    os: `${Device.osName ?? Platform.OS} ${Device.osVersion ?? ''}`.trim(),
    appVersion: APP_VERSION,
    pushToken,
  });
  await secure.setDeviceId(device.id);
  return { status: 'registered', deviceId: device.id };
}
