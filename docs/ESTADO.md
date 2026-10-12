# Estado del proyecto VAL-SISTEM

_Actualizado: 12 de octubre de 2026._ Este archivo reemplaza a los
documentos de estado del proyecto (`Estado_Web_VAL-SISTEM.md`,
`Estado_Backend_VAL-BACKEND.md`), que quedaron congelados al 29 de
septiembre. La lista de actividades vive en la Bitácora del MVP.

## Resumen

| Frente | Estado |
| --- | --- |
| Backend (NestJS + Prisma) | 25/25 actividades del MVP |
| Web (Next.js 16) | 11/11 pantallas del MVP |
| Móvil (Expo) | 0/7 — `apps/mobile` no existe todavía |
| QA | Pruebas unitarias del cálculo financiero ✅; resto pendiente |
| Infra | Monorepo, despliegue y CI ✅; staging, EAS, Sentry pendientes |

## Arquitectura

```
VAL-SISTEM/
├─ apps/
│  ├─ web/        Next.js 16 + TypeScript + Tailwind + TanStack Query
│  └─ backend/    NestJS + Prisma, 4 bases por dominio
│                 (user, market, portfolio, automation)
├─ packages/
│  └─ shared/     Tipos y utilidades compartidas web/móvil
├─ docs/          Este documento
└─ .github/       CI (GitHub Actions)
```

`npm run dev` levanta Postgres en Docker, migra, siembra y arranca web y
backend juntos (`scripts/dev-reset.js`).

## Despliegue

- **Web:** Vercel. El navegador llama a `/backend-api/*` en el mismo
  dominio y Next lo reenvía al backend (`apps/web/next.config.ts`). Así la
  cookie del refresh token es de primera parte y la sesión sobrevive a
  recargas.
- **Backend:** Render, plan gratuito, región **Frankfurt** (Binance bloquea
  IPs de EE.UU.). Blueprint en `render.yaml`.
- **Base de datos:** Neon (Postgres).

## Cambios desde el 29 de septiembre

- **29 sep.** `apps/backend` pasa a ser parte del monorepo (antes era el
  repo `VAL-BACKEND`). Preparación del despliegue: blueprint de Render,
  ruta de `start:prod` y `transpilePackages` para `@val-sistem/shared`.
  Fix de doble barra en las URLs del cliente API. El backend se mueve a
  Frankfurt.
- **30 sep.**
  - Las monedas nuevas se registran solas en el catálogo al sincronizar
    Binance (con su par contra USDT si existe).
  - Spot y Earn se separan en wallets distintas. Se agrega la vista
    virtual **General (todos)** y el selector de portafolio activo.
  - Sesión al recargar: proxy same-origin y reintentos del refresh.
  - Sync de **Fondos (Funding)** y de **Earn completo** (flexible + plazo
    fijo), cada uno en su propia wallet.
- **12 oct.**
  - El cálculo financiero pasa a `apps/backend/src/portfolio/cost-basis.ts`
    (funciones puras), usado por el alta manual, el sync de Binance y el
    resumen del portafolio. Antes estaba duplicado.
  - Primeras pruebas reales: `cost-basis.spec.ts` (costo promedio,
    ganancia realizada/no realizada, totales) y
    `transaction.service.spec.ts` (alta manual con Prisma simulado).
    `npm test` en `apps/backend`.
  - CI en GitHub Actions (`.github/workflows/ci.yml`): en cada push a
    `main` y en cada PR corre lint, tipos, tests y build del backend, y
    lint, tipos y build de la web.
  - Scripts nuevos: `lint:check` (backend, sin `--fix`) y `typecheck`
    (backend y web).
  - `next build` verificado en Windows.

## Cómo se calcula el costo y la ganancia

Método: **costo promedio ponderado**.

- **Compra / transfer_in:** el costo promedio se recalcula ponderando por
  cantidad.
- **Venta:** el costo promedio no cambia. La ganancia realizada suma
  `cantidad × (precio − costo promedio) − comisión`.
- **Transfer_out:** resta cantidad sin generar ganancia.
- Vender más de lo que hay falla en el alta manual (400).
- **No realizada:** `cantidad × (precio actual − costo promedio)`. Sin
  precio de mercado se usa el costo promedio, y la ganancia queda en 0.

Diferencias del sync de Binance (`computeCostBasisFromTrades`):

- El costo sale de `myTrades`. Una venta mayor a lo comprado se recorta a
  lo disponible.
- Las comisiones **no** se descuentan, porque Binance las cobra en BNB o
  en la moneda base.
- Los depósitos directos y las transferencias no aparecen en `myTrades`.
  La ganancia es una buena aproximación, no contabilidad exacta.
- USDT siempre tiene costo 1. Una moneda sin trades usa el precio de
  mercado.
- Cada sync reconstruye las posiciones de la wallet (modo espejo).

## Pendiente

### Prioridad alta

- Validar de punta a punta en producción con una cuenta real de Binance:
  conectar, sincronizar y revisar el costo base.
- **Cold start de Render:** el plan gratuito duerme a los 15 min y pausa
  los jobs (precios, sync, snapshots). Se puede mitigar con un ping
  externo cada 10–14 min o con un plan pago.
- Desactivar en producción las credenciales de prueba del seed.
- Mantener revocada la API key de Binance que se compartió en el chat.

### Producto y plataforma

- **App móvil** (Expo): setup, biometría, push token, tabs, push, offline
  y pruebas en simulador.
- **Pruebas restantes:** componentes (login, alta de exchange,
  transacción), E2E web con Playwright, E2E móvil y sync contra el testnet
  de Binance.
- **Infra:** entornos dev/staging/prod, EAS Build, TestFlight/Play
  Internal y Sentry.
- **Email real:** configurar `RESEND_API_KEY`. Hoy el link de recuperación
  solo se loguea.
- **Módulo Automation:** el schema existe pero falta el código (alertas,
  webhooks, notificaciones).
- **Fase 2:** watchlists, metas, tiempo real (SSE/WebSocket) y
  multi-exchange.

### Mejoras técnicas

- Sync incremental en lugar de modo espejo.
- Jobs con `setInterval`: se duplicarían con más de una instancia; hace
  falta una cola o un lock.
- Seguridad: rate limiting en `/auth/*`, 2FA (el campo ya existe) y
  sesiones activas.
- Higiene:
  - Borrar `apps/web/src/lib/mock-data.ts`, que está sin uso.
  - Corregir el typo `timezomeId`.
  - Archivar el repo `VAL-BACKEND`.
- Avisar en la UI que la ganancia de activos depositados es estimada.
- Barrido de accesibilidad AA.

### Decisiones de producto

- Alcance: solo trackeo, o también ejecución de órdenes.
- Identidad visual.
- Idiomas de lanzamiento (falta i18n).
- Términos de servicio y política de privacidad.
- Beta cerrada o tiendas públicas.
