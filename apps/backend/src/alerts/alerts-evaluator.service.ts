import { Injectable, Logger } from '@nestjs/common';
import { AutomationPrismaService } from '../prisma/automation-prisma.service';
import { MarketService } from '../market/market.service';
import {
  ALL_PORTFOLIOS,
  PortfolioService,
} from '../portfolio/portfolio.service';
import { GoalsService } from '../portfolio/goals.service';
import { StrategyService } from '../portfolio/strategy.service';
import { AlertsService } from './alerts.service';
import {
  AUTO_KINDS,
  cooldownPassed,
  crossed,
  dcaDueNotification,
  driftNotification,
  goalEvents,
  maxDrift,
  moveMet,
  moveNotification,
  priceMet,
  priceNotification,
  type AlertKind,
  type PendingNotification,
} from './alert-rules';

// Precios en USDT: formato simple en dólares.
const money = (n: number) =>
  `$${n.toLocaleString('es-EC', { maximumFractionDigits: n < 1 ? 6 : 2 })}`;

interface RuleUpdate {
  id: string;
  lastMet?: boolean;
  lastTriggeredAt?: Date;
  isActive?: boolean;
}

// Revisa todas las reglas (lo corre el job "alerts.evaluate" cada 5 min) y
// entrega los avisos nuevos. Un error en una regla o un usuario no corta el
// resto.
@Injectable()
export class AlertsEvaluatorService {
  private readonly logger = new Logger(AlertsEvaluatorService.name);

  constructor(
    private readonly prisma: AutomationPrismaService,
    private readonly market: MarketService,
    private readonly portfolios: PortfolioService,
    private readonly goals: GoalsService,
    private readonly strategy: StrategyService,
    private readonly alerts: AlertsService,
  ) {}

  async evaluateAll(
    now = new Date(),
  ): Promise<{ rules: number; notified: number }> {
    const pending: PendingNotification[] = [];
    const updates: RuleUpdate[] = [];

    const rules = await this.prisma.alertRule.findMany({
      where: { isActive: true, kind: { notIn: [...AUTO_KINDS] } },
    });
    const assetIds = [
      ...new Set(rules.map((r) => r.assetId).filter((a): a is string => !!a)),
    ];
    const [prices, assets] = await Promise.all([
      this.market.getPricesByAssetIds(assetIds),
      this.market.getAssetsByIds(assetIds),
    ]);

    for (const rule of rules) {
      const kind = rule.kind as AlertKind;
      const threshold = rule.threshold ?? 0;
      try {
        if (kind === 'price_above' || kind === 'price_below') {
          const price = prices.get(rule.assetId!)?.price;
          if (!price) continue;
          const met = priceMet(kind, price, threshold);
          const fire = crossed(met, rule.lastMet);
          if (fire) {
            pending.push(
              priceNotification(
                { id: rule.id, userId: rule.userId, kind, threshold },
                assets.get(rule.assetId!)?.symbol ?? '?',
                price,
                money,
                now,
              ),
            );
          }
          if (fire || met !== rule.lastMet) {
            updates.push({
              id: rule.id,
              lastMet: met,
              ...(fire ? { lastTriggeredAt: now, isActive: rule.repeat } : {}),
            });
          }
        } else if (kind === 'asset_move' || kind === 'portfolio_move') {
          if (!cooldownPassed(kind, rule.lastTriggeredAt, now)) continue;
          let change: number | undefined;
          let label: string;
          if (kind === 'asset_move') {
            change = prices.get(rule.assetId!)?.changePercent24h;
            label = assets.get(rule.assetId!)?.symbol ?? '?';
          } else {
            const summary = await this.portfolios.getSummary(
              rule.userId,
              rule.portfolioId ?? ALL_PORTFOLIOS,
            );
            change = summary.changePercent24h;
            label = rule.portfolioId ? 'Tu portafolio' : 'Tus portafolios';
          }
          if (change === undefined || !moveMet(change, threshold)) continue;
          pending.push(
            moveNotification(
              { id: rule.id, userId: rule.userId, kind, threshold },
              label,
              change,
              now,
            ),
          );
          updates.push({ id: rule.id, lastTriggeredAt: now });
        } else if (kind === 'strategy_drift' && rule.portfolioId) {
          if (!cooldownPassed(kind, rule.lastTriggeredAt, now)) continue;
          const plan = await this.strategy.getTargetAllocation(
            rule.userId,
            rule.portfolioId,
          );
          if (plan.targetsSum <= 0) continue;
          const worst = maxDrift(plan.rows);
          if (!worst || Math.abs(worst.diff) < threshold) continue;
          const portfolio = (await this.portfolios.list(rule.userId)).find(
            (p) => p.id === rule.portfolioId,
          );
          pending.push(
            driftNotification(
              { id: rule.id, userId: rule.userId, threshold },
              portfolio?.name ?? 'tu portafolio',
              worst,
              now,
            ),
          );
          updates.push({ id: rule.id, lastTriggeredAt: now });
        }
      } catch (err) {
        this.logger.warn(
          `Regla ${rule.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // Automáticas: activas salvo que el usuario las apague.
    const disabled = await this.prisma.alertRule.findMany({
      where: { isActive: false, kind: { in: [...AUTO_KINDS] } },
      select: { userId: true, kind: true },
    });
    const isOff = (userId: string, kind: AlertKind) =>
      disabled.some((d) => d.userId === userId && d.kind === kind);

    for (const userId of await this.goals.listUserIdsWithGoals()) {
      if (isOff(userId, 'goal_events')) continue;
      try {
        for (const goal of await this.goals.list(userId, ALL_PORTFOLIOS)) {
          pending.push(...goalEvents(userId, goal, now));
        }
      } catch (err) {
        this.logger.warn(
          `Metas de ${userId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    for (const userId of await this.strategy.listUserIdsWithActiveDca()) {
      if (isOff(userId, 'dca_due')) continue;
      try {
        for (const plan of await this.strategy.listDcaPlans(
          userId,
          ALL_PORTFOLIOS,
        )) {
          const n = dcaDueNotification(userId, plan, money, now);
          if (n) pending.push(n);
        }
      } catch (err) {
        this.logger.warn(
          `Compras de ${userId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    for (const u of updates) {
      const { id, ...data } = u;
      await this.prisma.alertRule.update({ where: { id }, data });
    }
    const notified = await this.alerts.deliver(pending);
    return { rules: rules.length, notified };
  }
}
