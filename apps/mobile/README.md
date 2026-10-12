# App móvil (Expo)

Cliente iOS/Android de VAL-SISTEM. Expo SDK 57, Expo Router, TanStack
Query y Zustand. Usa la misma API que la web y los tipos de
`@val-sistem/shared`.

## Correrla

El backend tiene que estar levantado (`npm run dev` en la raíz).

```bash
npm run dev:mobile
```

Para abrir la app hay dos caminos:

- **Expo Go:** escaneá el QR con la app Expo Go. Sirve para casi todo.
  Tiene dos límites: en Android no recibe push (desde el SDK 53, Expo Go
  no soporta push remoto en Android) y en iOS no puede usar Face ID.
- **Development build** (recomendado): una vez,
  `npx eas-cli build --profile development --platform android` (o `ios`)
  e instalá el binario. Después, `npm run dev:mobile` abre la app con
  recarga en caliente.

### URL del backend

| Situación | URL usada |
| --- | --- |
| Desarrollo | `http://<IP de la máquina que corre expo start>:3000`. Funciona en emulador y en un teléfono en la misma Wi-Fi. |
| `.env.local` con `EXPO_PUBLIC_API_URL` | Esa URL. |
| Builds `preview` / `production` | Las de `eas.json`. **Revisá que coincidan con la URL real de Render.** |

## Qué hay

- **Pantallas en tabs:** Inicio (valor, ganancia, distribución),
  Posiciones (por wallet), Movimientos (filtros y alta manual), Mercado y
  Ajustes. Fuera de las tabs: selector de portafolio (incluye "General")
  y conexión de Binance.
- **Sesión:**
  - El access token vive en memoria.
  - El refresh token se guarda en SecureStore (Keychain/Keystore). El
    backend lo entrega en el body cuando la petición trae
    `X-Client-Type: mobile`.
  - Una sola renovación en vuelo a la vez, porque el backend rota el
    token.
- **Biometría:** se activa en Ajustes. Con ella activa, al abrir la app se
  pide huella o Face ID antes de renovar la sesión. Si falla, también se
  acepta el PIN del teléfono.
- **Push:**
  - Al iniciar sesión se pide permiso y el push token de Expo se registra
    en `/devices`.
  - Al cerrar sesión, el dispositivo se da de baja.
  - Hace falta el `projectId` de EAS (`npx eas-cli init`).
  - El envío real de alertas depende del módulo Automation del backend.
- **Offline:**
  - La caché de consultas se guarda en AsyncStorage por 7 días.
  - Sin conexión, la app abre igual con los últimos datos y muestra
    "Sin conexión · datos de hace X".
  - La sesión se renueva sola al volver la red.
  - Al cerrar sesión se borra la caché.

## Calidad

```bash
npm run lint
npm run typecheck
npm test
npx expo export --platform android --platform ios
```

El CI corre los cuatro en cada push y PR.

## Monorepo: nota sobre React

La web usa React 19.2.8 y Expo SDK 57 fija React 19.2.3. `metro.config.js`
fuerza que todo `react` del bundle móvil salga de
`apps/mobile/node_modules`, así hay una sola copia (verificado en los
bundles). `expo-doctor` igual avisa "duplicate dependencies: react". Es
esperable: `react` no tiene código nativo, así que no afecta a los builds.

## Publicación (pendiente, requiere tus cuentas)

1. `npx eas-cli login` y `npx eas-cli init`. Esto agrega el `projectId` a
   `app.json`.
2. Credenciales de push:
   - FCM (Firebase) para Android.
   - APNs para iOS. EAS lo gestiona con la cuenta de Apple Developer.
3. Distribución interna:
   - `npx eas-cli build --profile preview` genera un APK o IPA
     instalable por link.
4. Tiendas:
   - `npx eas-cli build --profile production`.
   - `npx eas-cli submit --profile production`. Android va al track
     `internal` de Play; iOS, a TestFlight.
