# VAL-SISTEM

Monorepo del cliente web (y, más adelante, móvil) del sistema de
seguimiento de inversiones en criptomonedas. Consume la API del backend
[VAL-BACKEND](../VAL-BACKEND) — ningún cliente habla directo con Binance ni
con las bases de datos (ver `Especificacion_Web_Movil_MVP.md` en el
proyecto).

## Estructura

```
VAL-SISTEM/
├─ apps/
│  └─ web/            Next.js + TypeScript + Tailwind (App Router)
├─ packages/
│  └─ shared/          Tipos TS y utilidades (formato de moneda/porcentaje)
│                       compartidos entre web y, luego, la app móvil (RN)
├─ turbo.json           Pipeline de Turborepo (dev/build/lint/typecheck)
└─ package.json         Workspaces npm (apps/*, packages/*)
```

Stack según `Especificacion_Web_Movil_MVP.md` §4: Next.js + React +
TypeScript, TanStack Query (datos remotos), Zustand (estado local/sesión),
Tailwind CSS, Recharts (gráficos), monorepo con paquete `shared`.

## Cómo correrlo

Requiere Node 20+.

```bash
npm install
cp apps/web/.env.example apps/web/.env.local
npm run dev:web
```

Abre http://localhost:3000.

- `npm run dev` — corre todas las apps del monorepo (por ahora solo `web`).
- `npm run build` — build de producción de todas las apps.
- `npm run lint` / `npm run typecheck` — por app, vía Turborepo.

## Estado actual (24 sept 2026)

El backend (VAL-BACKEND) todavía no expone endpoints de negocio (auth,
portafolios, sync con Binance) — ver `Estado_Backend_VAL-BACKEND.md` en el
proyecto. Por eso la web está maquetada con datos de ejemplo
(`apps/web/src/lib/mock-data.ts`) siguiendo la recomendación de la
especificación: diseñar la UI/UX y los contratos de API primero, e ir
conectando cada pantalla a su endpoint real a medida que quede listo en el
backend.

Ya construido:

- Estructura de rutas para las 11 pantallas web del MVP (RFW-01 a RFW-11):
  login/registro/recuperación, dashboard, portafolios, posiciones,
  transacciones (+ registro manual), mercado, conexión de Binance, ajustes.
- Dashboard con gráficos (composición por activo, rendimiento histórico)
  siguiendo la guía de dataviz del proyecto (paleta validada, un solo eje,
  colores reservados de estado).
- Cliente API tipado (`apps/web/src/lib/api-client.ts`) con los endpoints
  esperados ya documentados como comentario, listo para reemplazar los
  mocks endpoint por endpoint.
- Sesión en memoria (Zustand) según RNFC-01: el access token nunca toca
  `localStorage`.

Pendiente (ver `Bitacora_MVP_Actividades.md` para la lista completa):

- Conectar cada pantalla a su endpoint real a medida que el backend los
  implemente (empezando por auth y el CRUD de portafolios).
- Modo oscuro: los gráficos hoy solo usan los tonos de modo claro (ver
  TODO en `apps/web/src/lib/chart-colors.ts`).
- Tests (Vitest/Jest + React Testing Library + Playwright, ver
  `Especificacion_Web_Movil_MVP.md` §12).
