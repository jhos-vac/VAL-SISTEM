# VAL-SISTEM

Monorepo del sistema de seguimiento de inversiones en criptomonedas:
cliente web, backend y, más adelante, la app móvil. Ningún cliente habla
directo con Binance ni con las bases de datos; todo pasa por la API del
backend (ver `Especificacion_Web_Movil_MVP.md` en el proyecto).

## Estructura

```
VAL-SISTEM/
├─ apps/
│  ├─ web/            Next.js + TypeScript + Tailwind (App Router)
│  ├─ mobile/         Expo (React Native) + Expo Router, ver su README
│  └─ backend/        NestJS + Prisma (4 bases: user, market, portfolio,
│                       automation)
├─ packages/
│  └─ shared/          Tipos TS y utilidades (formato de moneda/porcentaje)
│                       compartidos entre web y, luego, la app móvil (RN)
├─ docs/              Estado del proyecto
├─ turbo.json           Pipeline de Turborepo (dev/build/lint/typecheck)
└─ package.json         Workspaces npm (apps/*, packages/*)
```

Stack según `Especificacion_Web_Movil_MVP.md` §4: Next.js + React +
TypeScript, TanStack Query (datos remotos), Zustand (estado local/sesión),
Tailwind CSS, Recharts (gráficos), monorepo con paquete `shared`.

## Cómo correrlo

Requiere Node 20+ y Docker (para el Postgres local).

```bash
npm install
npm run dev
```

`npm run dev` recrea el Postgres local, migra y siembra las 4 bases, y
levanta el backend en http://localhost:3000 y la web en
http://localhost:3001. Con `npm run dev:no-reset` se conservan los datos.

- `npm run dev:mobile`: app móvil con Expo (ver `apps/mobile/README.md`).
- `npm run build`: build de producción de todas las apps.
- `npm run lint` / `npm run typecheck`: por app, vía Turborepo.

## Pruebas y CI

```bash
npm test --workspace=apps/backend
npm test --workspace=apps/mobile
```

El CI de GitHub Actions (`.github/workflows/ci.yml`) corre en cada push a
`main` y en cada PR:

- **Backend:** lint, tipos, tests y build.
- **Web:** lint, tipos y build.
- **Móvil:** lint, tipos, tests y bundle de Android/iOS.

## Estado actual

Ver [`docs/ESTADO.md`](docs/ESTADO.md): qué está hecho, cómo se calcula el
costo y la ganancia, y qué falta.
