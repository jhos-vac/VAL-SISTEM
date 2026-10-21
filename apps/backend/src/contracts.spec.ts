// Contrato API: las respuestas del backend tienen que encajar en los tipos
// de @val-sistem/shared, que es lo que consumen la web y la app móvil. Es una
// verificación de tipos (falla `npm run typecheck` y este test si alguien
// cambia un DTO sin actualizar shared, o al revés). Vive en un spec porque
// el build de producción no puede incluir packages/shared.
import type * as Shared from '@val-sistem/shared';
import type {
  AssetAllocationDto,
  AssetPositionDto,
  PerformancePointDto,
  PortfolioDto,
  PortfolioSummaryDto,
} from './portfolio/portfolio.service';
import type { TransactionDto } from './portfolio/transaction.service';
import type { ExchangeAccountDto } from './exchange/exchange.service';
import type { TickerDto } from './market/market.service';
import type { PublicUser } from './users/public-user';
import type { AssetLotsDto } from './portfolio/lots.service';
import type { GoalDto } from './portfolio/goals.service';
import type { DcaPlanDto } from './portfolio/strategy.service';
import type { RebalancePlan } from './portfolio/strategy';
import type { PublicPortfolioDto } from './portfolio/public-portfolios.service';
import type { AdminService } from './admin/admin.service';
import type {
  AlertsOverviewDto,
  NotificationDto,
} from './alerts/alerts.service';
import type { WatchlistItemDto } from './portfolio/watchlist.service';

// Cómo viaja un DTO por JSON: las fechas llegan como string.
type Json<T> = {
  [K in keyof T]: T[K] extends Date ? string : T[K];
};

// true solo si el DTO (tal como llega por JSON) es asignable al tipo
// compartido.
type Fits<Dto, SharedType> = [Json<Dto>] extends [SharedType] ? true : false;

// Igual que Json pero en profundidad (respuestas con objetos anidados).
type DeepJson<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? DeepJson<U>[]
    : T extends object
      ? { [K in keyof T]: DeepJson<T[K]> }
      : T;
type FitsDeep<Dto, SharedType> = [DeepJson<Dto>] extends [SharedType]
  ? true
  : false;
type AdminReturn<K extends keyof AdminService> = AdminService[K] extends (
  ...args: never[]
) => Promise<infer R>
  ? R
  : never;
type Expect<T extends true> = T;

export type ApiContracts = [
  Expect<Fits<PortfolioDto, Shared.Portfolio>>,
  Expect<Fits<PortfolioSummaryDto, Shared.PortfolioSummary>>,
  Expect<Fits<AssetPositionDto, Shared.AssetPosition>>,
  Expect<Fits<AssetAllocationDto, Shared.AssetAllocation>>,
  Expect<Fits<PerformancePointDto, Shared.PerformancePoint>>,
  Expect<Fits<TransactionDto, Shared.Transaction>>,
  Expect<Fits<ExchangeAccountDto, Shared.ExchangeAccount>>,
  Expect<Fits<TickerDto, Shared.MarketTicker>>,
  Expect<Fits<PublicUser, Shared.User>>,
  Expect<Fits<AssetLotsDto, Shared.AssetLots>>,
  Expect<Fits<GoalDto, Shared.Goal>>,
  Expect<Fits<DcaPlanDto, Shared.DcaPlan>>,
  Expect<Fits<RebalancePlan, Shared.RebalancePlan>>,
  Expect<Fits<PublicPortfolioDto, Shared.PublicPortfolio>>,
  Expect<FitsDeep<AdminReturn<'overview'>, Shared.AdminOverview>>,
  Expect<FitsDeep<AdminReturn<'listUsers'>, Shared.AdminUserPage>>,
  Expect<FitsDeep<AdminReturn<'health'>, Shared.AdminHealth>>,
  Expect<
    FitsDeep<AdminReturn<'listPublicPortfolios'>, Shared.AdminPublicPortfolio[]>
  >,
  Expect<FitsDeep<AlertsOverviewDto, Shared.AlertsOverview>>,
  Expect<Fits<NotificationDto, Shared.AppNotification>>,
  Expect<Fits<WatchlistItemDto, Shared.WatchlistItem>>,
];

describe('contratos API backend ↔ @val-sistem/shared', () => {
  it('se verifican en tiempo de compilación (ver ApiContracts)', () => {
    const checked: ApiContracts['length'] = 21;
    expect(checked).toBe(21);
  });
});
