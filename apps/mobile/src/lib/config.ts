import Constants from 'expo-constants';

// URL del backend. Prioridad:
//  1. EXPO_PUBLIC_API_URL (eas.json por perfil, o .env.local).
//  2. En desarrollo: el puerto 3000 de la máquina que corre `expo start`
//     (sale de hostUri), así funciona igual en emulador y en un teléfono
//     físico en la misma red, sin tocar nada.
export function resolveApiUrl(
  envUrl: string | undefined,
  hostUri: string | undefined,
): string {
  if (envUrl) return envUrl.replace(/\/+$/, '');
  const host = hostUri?.split(':')[0];
  return `http://${host || 'localhost'}:3000`;
}

export const API_URL = resolveApiUrl(
  process.env.EXPO_PUBLIC_API_URL,
  Constants.expoConfig?.hostUri,
);

export const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';

// projectId de EAS: hace falta para pedir el push token de Expo. Se
// completa solo al correr `npx eas-cli init`.
export const EAS_PROJECT_ID: string | undefined =
  (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)
    ?.projectId ?? Constants.easConfig?.projectId;
