// Todo lo sensible del dispositivo vive en SecureStore (Keychain en iOS,
// Keystore en Android), nunca en AsyncStorage.
import * as SecureStore from 'expo-secure-store';

const REFRESH_TOKEN = 'val.refreshToken';
const BIOMETRIC_ENABLED = 'val.biometricEnabled';
const DEVICE_ID = 'val.deviceId';

export const secure = {
  getRefreshToken: () => SecureStore.getItemAsync(REFRESH_TOKEN),
  setRefreshToken: (token: string) => SecureStore.setItemAsync(REFRESH_TOKEN, token),
  clearRefreshToken: () => SecureStore.deleteItemAsync(REFRESH_TOKEN),

  async getBiometricEnabled(): Promise<boolean> {
    return (await SecureStore.getItemAsync(BIOMETRIC_ENABLED)) === 'true';
  },
  setBiometricEnabled: (enabled: boolean) =>
    SecureStore.setItemAsync(BIOMETRIC_ENABLED, String(enabled)),

  // Id del dispositivo registrado en /devices, para darlo de baja al
  // cerrar sesión (y dejar de recibir push en este teléfono).
  getDeviceId: () => SecureStore.getItemAsync(DEVICE_ID),
  setDeviceId: (id: string) => SecureStore.setItemAsync(DEVICE_ID, id),
  clearDeviceId: () => SecureStore.deleteItemAsync(DEVICE_ID),
};
