# Estado del proyecto VAL-SISTEM

_Actualizado: 14 de octubre de 2026._ Este archivo reemplaza a los
documentos de estado del proyecto (`Estado_Web_VAL-SISTEM.md`,
`Estado_Backend_VAL-BACKEND.md`), que quedaron congelados al 29 de
septiembre. La lista de actividades vive en la Bitácora del MVP.

## Resumen

| Frente | Estado |
| --- | --- |
| Backend (NestJS + Prisma) | 25/25 actividades del MVP |
| Web (Next.js 16) | 11/11 pantallas del MVP |
| Móvil (Expo) | 5/7 en código. Faltan pruebas en simulador y push de punta a punta, que necesitan cuentas de EAS/Apple/Google |
| QA | Pruebas unitarias del cálculo financiero ✅; resto pendiente |
| Infra | Monorepo, despliegue, CI y config de EAS ✅; staging, credenciales EAS y Sentry pendientes |

## Arquitectura

```
VAL-SISTEM/
├─ apps/
│  ├─ web/        Next.js 16 + TypeScript + Tailwind + TanStack Query
│  ├─ mobile/     Expo SDK 57 + Expo Router (ver apps/mobile/README.md)
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
  - **App móvil** (`apps/mobile`):
    - Login, registro y recuperación.
    - Desbloqueo con huella o Face ID.
    - Registro del push token en `/devices`.
    - Tabs: Inicio, Posiciones, Movimientos, Plan y Ajustes.
    - Plan: Metas (con alta y vista previa), Estrategia (editor +/- que no
      pasa del 100 %), Compras periódicas (DCA), Rendimiento por compra,
      Explorar (ranking y copia de portafolios públicos) y Mercado.
    - Historial: las monedas capital (USDT…) se ocultan; un interruptor
      "Mostrar capital" las trae (`GET /transactions?includeCapital=true`).
    - Ajustes: perfil, preferencias (tema, moneda, idioma y zona horaria,
      compartidas con la web), moneda capital, portafolios (crear, editar,
      predeterminado y publicar en el ranking) y desconectar Binance.
    - Historial con filtros por tipo, activo y período.
    - Diseño: tarjetas redondeadas y barra de pestañas flotante que sigue
      al modo. En Preferencias se elige el modo (del teléfono, claro u
      oscuro; se guarda en la cuenta) y los colores (Verde, Grafito, Café o
      Pizarra; se guardan en el teléfono).
    - Posiciones ordenables (alfabético, ganancia, %, valor); tocar una abre
      sus compras. La lógica de orden y asignación vive en
      `@val-sistem/shared` y la comparten web y móvil.
    - Alta manual de transacciones, selector de portafolio (con "General")
      y conexión de Binance.
    - Modo offline con caché persistida y aviso de antigüedad de los datos.
    - `eas.json` con perfiles development, preview y production.
  - Backend: con el header `X-Client-Type: mobile`, `login` y `refresh`
    devuelven el refresh token en el body (sin cookie). Tiene prueba en
    `auth.controller.spec.ts`.
  - CI:
    - Se agrega el job móvil: lint, tipos, 24 tests y bundle de Android e
      iOS.
    - Arreglo del typecheck de la web, que fallaba en CI porque
      `next-env.d.ts` no se versiona; ahora corre `next typegen` antes de
      `tsc`.

- **13 oct. Monedas capital.**
  - El usuario marca en Ajustes qué monedas usa como dinero y no como
    inversión (p.ej. USDT, como dólares virtuales).
  - Esas monedas suman al valor total (y se informan como
    `capitalValue`), pero quedan fuera de invertido, ganancia
    realizada/no realizada y variación 24h, también en los snapshots.
  - Se guardan por usuario en la tabla `capital_assets` (base portfolio,
    migración `20261013120000_capital_assets`), con los endpoints
    `GET/PUT /capital-assets`.
  - En posiciones, esas monedas se marcan como "Capital" y se muestran
    sin ganancia.
  - Se borra `apps/web/src/lib/mock-data.ts`, que estaba sin uso.

- **13 oct. Revisión ACID y de módulos** (ver
  `docs/REVISION_ACID_MODULOS.md`, con todo lo resuelto):
  - Transacciones y locks donde había carreras o pasos sueltos.
  - El sync escribe en lote con un lock por cuenta.
  - Jobs centralizados en `jobs/` con lease.
  - Exchange ya no escribe en la base Portfolio.
  - Un módulo Prisma por base, con regla de lint.
  - Contratos de la API verificados contra `shared`.
- **Migraciones nuevas que hay que aplicar en producción ANTES del deploy
  del backend:**
  - Portfolio: `20261013120000_capital_assets` y
    `20261013130000_job_leases`. Se aplican con
    `npm run db:deploy:portfolio`.
  - User: `20261013140000_unique_settings_devices`. Antes de crear los
    índices únicos borra los ajustes y dispositivos duplicados. Se aplica
    con `npm run db:deploy:user`.

- **13 oct. Migraciones automáticas y borrado de cuenta.**
  - El build de Render corre `db:deploy` al final: cada deploy aplica las
    migraciones pendientes antes de arrancar el código nuevo.
  - Borrado de cuenta en Ajustes, en la web y en la app (lo exigen App
    Store y Google Play). Pide la contraseña.
  - La cuenta se da de baja sin datos personales y se borran sus
    portafolios, posiciones, cuentas de Binance, watchlists y monedas
    capital.
  - Un job repite la limpieza durante 30 días.

- **14 oct. Seguimiento, metas, estrategias y portafolios públicos**
  (web; migración `20261014120000_goals_strategies_public`):
  - **Por compra** (`/lots`, `GET /positions/lots`):
    - Cada compra es un lote con su precio, lo que queda, su valor y su
      ganancia. Las ventas consumen lotes FIFO, solo en esta vista; el
      resumen sigue usando el costo promedio.
    - El saldo sin compra registrada (depósitos) se muestra aparte, al
      costo promedio.
  - **Metas** (`/goals`):
    - Valor objetivo con fecha opcional (progreso, faltante, ritmo
      mensual).
    - % de ganancia sobre lo invertido.
    - Del portafolio o de un activo.
  - **Estrategia** (`/strategy`):
    - Asignación objetivo por activo, con sugerencias de compra o venta
      para rebalancear.
    - Planes DCA, con lo planeado contra lo comprado (cuenta todas las
      compras del activo desde el inicio del plan).
  - **Explorar** (`/explore`):
    - Ranking opt-in por rendimiento sobre lo invertido. Solo muestra
      porcentajes y alias, nunca montos ni datos del dueño.
    - Copiar crea un portafolio con esa composición como asignación
      objetivo.
  - Verificado de punta a punta contra un Postgres real (24 casos) y en el
    navegador.
  - **Pendiente:** estas pantallas en la app móvil.

- **15 oct. Capital aparte, metas y DCA interactivos, orden de posiciones.**
  - Las monedas capital (p.ej. USDT) **ya no forman parte del portafolio**:
    se muestran solo como "Capital" en el dashboard y en la barra superior.
  - `totalValue` del resumen excluye el capital, y queda fuera de:
    - posiciones, composición, compras (lotes) y snapshots;
    - estrategia (el backend rechaza un objetivo en una moneda capital);
    - ranking público.
  - Metas: anillos de progreso, avance contra tiempo y formulario con
    atajos y vista previa.
  - DCA: estado (al día, atrasado o adelantado), barras de planeado contra
    comprado y formulario con proyección.
  - Posiciones: orden por alfabético, ganancia ($ o %) o valor. Se
    recuerda la elección.

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
- USDT siempre tiene costo 1.
- **Precio de compra fijo.** Una moneda sin trades (llegó por Convertir,
  tarjeta, depósito o Earn) se valora UNA vez con el precio de cada depósito,
  conversión o compra con tarjeta del último año, en su momento (velas de 1
  minuto de Binance). Si no hay registro, se fija el precio del día en que la
  app la vio. Los syncs siguientes conservan ese precio; si llega más
  cantidad, solo lo nuevo se valora al precio de ese momento. Cada posición
  guarda `cost_source` y `cost_fixed_at`. Las posiciones de exchange
  anteriores quedaron como `legacy` y se recalculan en el próximo sync.
- **Revisión** (web `/review` y móvil): cuánto subió o bajó cada moneda
  desde su precio de compra, con el origen de ese precio.
- Cada sync reconstruye las posiciones de la wallet (modo espejo).

## Metas

- Cuatro tipos: llegar a un valor, ganar un %, juntar una cantidad de una
  moneda y precio objetivo (sube o baja según el precio al crearla; una vez
  tocado queda cumplida, con `completed_at`).
- Se pueden editar: nombre, objetivo y fecha. El tipo y la moneda no.
- Proyección: recta de mínimos cuadrados sobre los snapshots diarios de los
  últimos 90 días (valor del portafolio o de la moneda, o su cantidad). Da el
  ritmo por mes, la fecha estimada y si llega a tiempo. No aplica a metas de
  precio. Hace falta al menos una semana de historia.
- Gráfico de los últimos 90 días de lo que mide la meta (valor, %, cantidad
  o precio), con el objetivo punteado; hitos de 25, 50 y 75 %; las
  cumplidas van en su propia sección.
- Plan sugerido: con fecha límite, cuánto comprar por semana para cubrir lo
  que falta (sin contar el mercado), con un botón que crea el plan DCA hasta
  esa fecha.

## Panel de administración

- Web `/admin`, visible solo con rol admin. El backend exige
  `@Roles('admin')` en todo `/admin/*`.
- Resumen: usuarios, actividad, altas por día y uso (portafolios,
  transacciones, Binance, metas y DCA).
- Usuarios: búsqueda, filtro por estado y suspender o reactivar.
  Suspender cierra todas las sesiones; nadie puede suspenderse a sí mismo.
- Salud: estado de cada job (última corrida, duración y error, guardados en
  `job_leases`), antigüedad de los precios y acciones fallidas de las
  últimas 24 h (`audit_logs`).
- Públicos: lista con el email del dueño; despublicar borra el alias.
- Dar o quitar el rol: `npm run admin -- grant <email>` y
  `npm run admin -- revoke <email>` (en `apps/backend`, con el
  `DATABASE_USER` de la base que corresponda). El usuario tiene que volver
  a iniciar sesión.

## Pendiente

### Prioridad alta

- Validar de punta a punta en producción con una cuenta real de Binance:
  conectar, sincronizar y revisar el costo base.
- **Cold start de Render:** el plan gratuito duerme a los 15 min y pausa
  los jobs (precios, sync, snapshots). Se puede mitigar con un ping
  externo cada 10–14 min o con un plan pago.
- Credenciales de prueba del seed: `db:seed:user` ya no crea los usuarios
  de prueba fuera de una base local (salvo `SEED_TEST_USERS=true`). Falta
  revisar producción con `npm run admin -- seed-users` y, si aparecen,
  suspenderlos con `npm run admin -- seed-users --disable`.
- Mantener revocada la API key de Binance que se compartió en el chat.

### Producto y plataforma

- **App móvil**, lo que necesita tus cuentas:
  - `npx eas-cli init` (projectId).
  - Credenciales FCM/APNs.
  - Development build y prueba en simulador o teléfono.
  - Confirmar la URL de Render en `apps/mobile/eas.json`.
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
