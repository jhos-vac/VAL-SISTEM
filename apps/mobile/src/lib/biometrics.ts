import * as LocalAuthentication from 'expo-local-authentication';

// Hay hardware (huella / Face ID) y el usuario tiene al menos una
// registrada en el sistema.
export async function isBiometricAvailable(): Promise<boolean> {
  const [hasHardware, isEnrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return hasHardware && isEnrolled;
}

export async function authenticateWithBiometrics(promptMessage: string): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel: 'Cancelar',
    // Permite el PIN / patrón del teléfono si la biometría falla.
    disableDeviceFallback: false,
  });
  return result.success;
}
