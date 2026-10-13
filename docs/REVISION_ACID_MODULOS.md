# Revisión: ACID, cohesión y acoplamiento

_13 de octubre de 2026. Alcance: `apps/backend` (todas las escrituras a
base de datos y las dependencias entre módulos), y los contratos entre
web, móvil y `packages/shared`._

## Veredicto

La base es sana:

- Hay módulos por dominio alineados con las 4 bases.
- Los controllers son delgados.
- El cálculo financiero está en funciones puras.
- Los flujos más delicados ya usan transacciones: alta manual, reset de
  contraseña, desconexión de Binance y reconstrucción del sync.

Para crecer sin perder datos hay que cerrar tres frentes:

1. **Aislamiento.** Varios flujos leen, deciden y escriben sin bloquear la
   fila. Con dos pedidos simultáneos se pierden actualizaciones.
2. **Atomicidad.** Algunos flujos de varios pasos no están en una
   transacción y pueden quedar a medias.
3. **Acoplamiento.** El módulo Exchange escribe directo en las tablas de
   Portfolio, y el acceso a las bases es global.

## 1. ACID: hallazgos

Severidad:

- **Alta:** se pierden datos o se rompe una garantía de seguridad.
- **Media:** quedan datos inconsistentes o errores 500 evitables.
- **Baja:** riesgo acotado.

### Alta

**A1. Las transacciones manuales pueden borrarse en el próximo sync
(durabilidad).**

- **Dónde:** `getOrCreateDefaultWallet` (web) usa `wallets[0]`, ordenado
  por fecha de creación.
- **Qué pasa:** si el usuario conectó Binance antes de registrar algo a
  mano, la primera wallet es la de Binance (Spot). La compra manual se
  guarda ahí, y `BinanceAccountSyncService` reconstruye esa wallet desde
  cero a los ≤15 min. La transacción desaparece sin aviso.
- **Por qué el backend no lo frena:** `TransactionService` no lo impide.
- **Arreglo:**
  - El backend rechaza escrituras manuales en wallets
    `walletType: 'exchange'`.
  - La web elige o crea siempre una wallet `manual`, como ya hace la app
    móvil.

**A2. Actualización perdida en compras o ventas simultáneas
(aislamiento).**

- **Dónde:** `TransactionService.create` lee la posición, calcula y la
  escribe dentro de `$transaction`, con el aislamiento por defecto de
  Postgres (READ COMMITTED) y sin bloquear la fila.
- **Qué pasa:** con una posición de 4 BTC, dos ventas de 3 BTC al mismo
  tiempo leen las dos "4", pasan la validación, y la última escritura
  gana. Quedan 1 BTC y dos ventas registradas, en lugar de rechazar la
  segunda. El costo promedio y la ganancia realizada también quedan mal.
- **Arreglo:** antes de leer, bloquear la fila con
  `SELECT … FOR UPDATE`, o usar `isolationLevel: Serializable` con
  reintento ante conflicto de serialización. Aplica igual a dos compras
  (el costo promedio se calcula sobre un dato viejo).

**A3. Un refresh token puede usarse dos veces en paralelo (aislamiento y
seguridad).**

- **Dónde:** `AuthService.refresh` hace `findUnique`, verifica
  `revokedAt` y después `update` sin condición.
- **Qué pasa:** dos pedidos simultáneos con el mismo token pasan la
  verificación y obtienen cada uno una sesión nueva. La rotación deja de
  garantizar el uso único.
- **Arreglo:** revocar con un `updateMany({ where: { id, revokedAt: null } })`
  dentro de una transacción junto con la emisión del token nuevo, y
  continuar solo si `count === 1`.

**A4. El sync puede abortar por tiempo en cuentas grandes (atomicidad
garantizada, pero falla).**

- **Dónde:** la reconstrucción de wallets en
  `BinanceAccountSyncService` es una transacción interactiva. Hace 2+
  consultas secuenciales por activo y usa el timeout por defecto de
  Prisma (5 s).
- **Qué pasa:** el backend corre en Render (Frankfurt) y la base en Neon
  (`us-east-2`). Cada ida y vuelta cruza el Atlántico. Con unas decenas
  de activos, la transacción supera los 5 s y Prisma la cancela. No
  quedan datos a medias (hace rollback), pero el sync falla siempre para
  esa cuenta.
- **Arreglo:**
  - Agrupar las escrituras en `createMany` en vez de un `create` por
    activo.
  - Fijar un `timeout` explícito.
  - Idealmente, mover la base a una región europea de Neon, cerca del
    backend. Eso también acelera todas las pantallas.

### Media

**M1. Registro no atómico.**

- **Dónde:** `user.create` y `userRole.create` son dos escrituras
  separadas.
- **Qué pasa:**
  - Si falla la segunda, queda un usuario sin rol.
  - La verificación previa de email/usuario duplicado es leer-y-después-
    insertar: dos registros simultáneos chocan con el `@unique` y uno
    recibe un 500 en lugar de un 409.
- **Arreglo:** hacer las dos escrituras en una `$transaction` y traducir
  el error P2002 a 409.

**M2. Cambio de contraseña no atómico.**

- **Dónde:** `changePassword` actualiza la contraseña y después revoca
  las sesiones, en dos pasos.
- **Qué pasa:** si falla el segundo paso, las sesiones viejas siguen
  activas con la contraseña ya cambiada.
- **Arreglo:** hacer las dos escrituras en una `$transaction`, igual que
  ya hace `resetPassword`.

**M3. Conectar Binance no es atómico.**

- **Dónde:** `exchangeAccount.create` y `wallet.create` van separados.
- **Qué pasa:** si falla la wallet, queda una cuenta conectada sin wallet,
  y el sync periódico falla con ella cada 15 minutos para siempre.
- **Arreglo:** hacer las dos escrituras en una `$transaction`. Además, el
  portafolio por defecto se crea duplicando la lógica de
  `PortfolioService` (ver C3).

**M4. Syncs simultáneos de la misma cuenta.**

- **Dónde:** el flag `running` es solo de memoria y solo cubre el job
  periódico.
- **Qué pasa:**
  - Un sync manual (`POST /exchange-accounts/:id/sync`, o el de
    `connect`) puede coincidir con el periódico. Las dos reconstrucciones
    chocan con `@@unique([walletId, assetId])` y una falla.
  - Con dos instancias del backend, todos los jobs se duplican.
- **Arreglo:** un lock por cuenta con `pg_advisory_xact_lock(hash(accountId))`
  al inicio de la reconstrucción, y un lock global por job.

**M5. Filas duplicadas en ajustes y dispositivos.**

- **Dónde:** `SettingsService.updateSettings` y `DevicesService.register`
  hacen leer-y-después-insertar, sin restricción única. `UserSetting.userId`
  y `(Device.userId, pushToken)` no son `@unique`.
- **Qué pasa:** dos pedidos simultáneos crean dos filas. Después
  `findFirst` devuelve una cualquiera.
- **Arreglo:** agregar índices únicos (con una migración que primero
  limpie duplicados) y usar `upsert`.

### Baja

**B1. Snapshots en dos pasos.** El `upsert` del snapshot y sus ítems van
en transacciones distintas. Si falla la segunda, queda el total de ese
día con ítems viejos. **Arreglo:** una sola transacción.

**B2. Dos portafolios predeterminados.** `create`/`update` con
`isDefault` están en una transacción, pero dos pedidos simultáneos pueden
dejar dos portafolios predeterminados. **Arreglo:** índice único parcial
`WHERE is_default` por usuario.

**B3. Referencias entre bases sin clave foránea.** Portfolio guarda
`userId` (base User) y `assetId` (base Market) sin FK. Es inevitable con
una base por dominio, pero implica dos cosas:

- Borrar un usuario no limpia sus portafolios.
- Los assets nunca deben borrarse, solo desactivarse. Hoy se cumple, pero
  la regla no está escrita en ningún lado.

**Arreglo:** documentar la regla y, cuando exista el borrado de cuenta,
limpiar los datos con un proceso explícito (job o evento).

### Lo que ya está bien

- `resetPassword`, la desconexión de Binance, la reconstrucción del sync,
  `capital-assets` y el cambio de portafolio predeterminado son atómicos.
- Las llamadas a Binance se hacen **antes** de abrir la transacción: no
  hay transacciones abiertas esperando a la red.
- Los upserts del catálogo de Market son idempotentes. Si se cortan, la
  siguiente corrida los completa.
- La durabilidad la da Postgres administrado (Neon). No hay estado de
  negocio solo en memoria, salvo los flags de los jobs (M4).

## 2. Cohesión y acoplamiento

### Lo que está bien

- **Un módulo por dominio** (`auth`, `users`, `devices`, `market`,
  `portfolio`, `exchange`), cada uno con su controller, servicios y DTOs.
- **Market se consume por métodos** (`MarketService`), no leyendo sus
  tablas: Portfolio no conoce el schema de Market.
- **El núcleo financiero está aislado** (`portfolio/cost-basis.ts`): son
  funciones puras, testeadas y reutilizadas por alta manual, sync,
  resumen y snapshots.
- **El cliente de Binance está separado del sync**
  (`BinanceAccountClientService`).
- **En el frontend**, los clientes HTTP están separados por dominio en web
  y móvil.

### Problemas

**C1. Exchange escribe directo en las tablas de Portfolio (acoplamiento
alto).**

- **Dónde:** `BinanceAccountSyncService` y `ExchangeService` crean y
  borran wallets, posiciones y transacciones con `PortfolioPrismaService`.
- **Qué pasa:** las reglas de una posición viven en dos lugares, y
  cualquier cambio al schema de Portfolio obliga a tocar Exchange. A1 es
  justo un síntoma de esto: Portfolio no sabe qué wallets son
  "propiedad" del sync.
- **Arreglo:** que `PortfolioModule` exponga una API de escritura, por
  ejemplo un `PositionLedgerService` con:
  - `ensureExchangeWallets(account)`.
  - `replaceWalletSnapshot(walletId, balances, trades)`.
  - `deleteExchangeWallets(accountId)`.

  Exchange queda con una sola responsabilidad: hablar con Binance y
  traducir sus datos a esos comandos.

**C2. `PrismaModule` es `@Global` y exporta las 3 bases.**

- **Qué pasa:** cualquier módulo puede leer o escribir cualquier base, y
  nada impide que vuelva a pasar C1. Hoy además `AuditLogInterceptor`
  (en `common`) escribe en la base User.
- **Arreglo:**
  - Un módulo Prisma por dominio, importado solo por su dueño.
  - Una regla de lint (`no-restricted-imports` o
    `eslint-plugin-boundaries`) que falle si, por ejemplo, `exchange/`
    importa `portfolio-prisma.service`.

**C3. Lógica duplicada para el portafolio por defecto.**

- **Dónde:** `ExchangeService.resolveDefaultPortfolio` crea portafolios
  por su cuenta.
- **Qué pasa:** se saltea `PortfolioService.create`, que maneja la regla
  de un solo predeterminado.
- **Arreglo:** que `PortfolioService` exponga `getOrCreateDefault(userId)`.

**C4. Jobs mezclados con la lógica de dominio.**

- **Dónde:** el sync de precios, el de cuentas y los snapshots usan
  `setInterval` dentro de servicios de dominio.
- **Qué pasa:**
  - Programar y ejecutar quedan acoplados.
  - No escalan a más de una instancia (M4).
  - En Render gratis se pausan con el backend dormido.
- **Arreglo:** un módulo `jobs` con `@nestjs/schedule` y un lock en base,
  que solo llame a métodos públicos de cada dominio.

**C5. Dependencia invertida entre `users` y `auth`.**

- **Dónde:** `users.service` importa `toPublicUser` desde
  `auth.service`.
- **Arreglo:** el dueño de `User` es Users, así que el mapper debería
  vivir ahí o en un archivo neutro (`users/public-user.ts`).

**C6. Contratos API duplicados.**

- **Dónde:**
  - El backend define sus propias interfaces de respuesta
    (`PortfolioSummaryDto`, …).
  - `packages/shared` las repite a mano.
  - Web y móvil tienen cada uno sus clientes HTTP y su propia lógica de
    "portafolio activo".
- **Qué pasa:** cada cambio de contrato se hace en 3 o 4 lugares, y
  cuando se olvida uno, el desfase solo se descubre en runtime.
- **Arreglo:**
  - Que el backend tipe sus respuestas con los tipos de
    `@val-sistem/shared`.
  - Mover a `shared` lo puro común: `resolveActivePortfolio`, las
    etiquetas y, más adelante, un cliente HTTP con `fetch` inyectable.

## 3. Estado (13 de octubre de 2026)

Todo lo anterior quedó resuelto en los commits de las fases 1 a 4, salvo
lo marcado como pendiente.

| Hallazgo | Solución aplicada |
| --- | --- |
| A1 | El backend rechaza movimientos manuales en wallets `exchange`; web y móvil usan siempre una wallet `manual`. |
| A2 | `SELECT … FOR UPDATE` sobre la wallet antes de leer la posición. |
| A3 | Revocación condicional (`updateMany … revokedAt: null`, `count === 1`) en la misma transacción que emite el token nuevo. |
| A4 | `PositionLedgerService`: escritura en lote (unas 10 consultas fijas) y timeout de 30 s. **Pendiente (tuyo):** mover Neon a una región europea. |
| M1, M2, M3 | Transacciones; P2002 → 409 en el registro. |
| M4 | Lock por cuenta (`pg_try_advisory_xact_lock`): el segundo sync devuelve `skipped`. Jobs con lease en `job_leases`. |
| M5 | Índices únicos en `user_settings.user_ID` y `devices(user_ID, push_token)` (la migración limpia duplicados antes) y `upsert`. |
| B1 | Snapshot e ítems en una transacción. |
| B2 | Lock por usuario en create/update/getOrCreateDefault de portafolios. |
| B3 | Documentado: los assets nunca se borran, solo se desactivan. **Pendiente:** limpieza al borrar una cuenta, cuando exista esa función. |
| C1 | Exchange persiste solo por `ExchangeAccountStore` y `PositionLedgerService` (exportados por Portfolio). |
| C2 | Un módulo Prisma por base, sin `@Global`, y una regla de ESLint (`no-restricted-imports`) que falla si un módulo importa el cliente de otra base. |
| C3 | `PortfolioService.getOrCreateDefault`. |
| C4 | Módulo `jobs/` con lease; los servicios de dominio solo exponen el trabajo. |
| C5 | `users/public-user.ts`. |
| C6 | `resolveActivePortfolio`, `ALL_PORTFOLIOS_ID` y las etiquetas de tipo viven en `shared` (web y móvil los usan). `src/contracts.spec.ts` verifica en compilación que los DTOs del backend encajan en los tipos de `shared`. |

Hallazgos que aparecieron al arreglar:

- Las transacciones del sync se informaban como `source: 'manual'`. Ahora
  son `'sync'`.
- La primera versión de la regla de ESLint no protegía nada, porque en
  flat config la última definición de una regla pisa a las anteriores. Se
  rehízo por área y se verificó con un archivo que la viola.

## 4. Plan propuesto (original)

| Fase | Contenido | Por qué primero |
| --- | --- | --- |
| 1 | A1, A2, A3, M1, M2, M3 | Pérdida de datos y seguridad. Son cambios chicos y locales, con tests. |
| 2 | A4, M4 + C4 (jobs con lock) | El sync es lo que más va a crecer. |
| 3 | C1, C2, C3, C5 | Ordenar los límites antes de construir Automation y multi-exchange, que van a querer escribir posiciones también. |
| 4 | M5, B1, B2, C6 | Migraciones de limpieza y contratos compartidos. |

Las fases 1 y 2 no cambian el schema, salvo los índices de M5. Las
fases 3 y 4 son refactors internos sin cambio de API, cubiertos por los
tests existentes más los nuevos.
