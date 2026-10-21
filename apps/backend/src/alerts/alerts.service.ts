import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AutomationPrismaService } from '../prisma/automation-prisma.service';
import { MarketService } from '../market/market.service';
import { PortfolioService } from '../portfolio/portfolio.service';
import { DevicesService } from '../devices/devices.service';
import { SettingsService } from '../users/settings.service';
import { PushService } from './push.service';
import {
  AUTO_KINDS,
  type AlertKind,
  type PendingNotification,
} from './alert-rules';
import type {
  CreateAlertRuleDto,
  SetAutoAlertDto,
  UpdateAlertRuleDto,
} from './dto/alerts.dto';

export interface AlertRuleDto {
  id: string;
  kind: AlertKind;
  assetSymbol: string | null;
  portfolioId: string | null;
  portfolioName: string | null;
  threshold: number | null;
  repeat: boolean;
  isActive: boolean;
  lastTriggeredAt: string | null;
  createdAt: string;
}

export interface AlertsOverviewDto {
  rules: AlertRuleDto[];
  auto: { goalEvents: boolean; dcaDue: boolean };
}

export interface NotificationDto {
  id: string;
  kind: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

// Reglas de aviso del usuario y su centro de notificaciones. Es el único
// módulo que usa la base Automation; lo demás lo pide a cada dominio por su
// API pública.
@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private readonly prisma: AutomationPrismaService,
    private readonly market: MarketService,
    private readonly portfolios: PortfolioService,
    private readonly devices: DevicesService,
    private readonly settings: SettingsService,
    private readonly push: PushService,
  ) {}

  // --- Reglas ---

  async overview(userId: string): Promise<AlertsOverviewDto> {
    const rows = await this.prisma.alertRule.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    const manual = rows.filter(
      (r) => !AUTO_KINDS.includes(r.kind as AlertKind),
    );
    const autoOff = (kind: AlertKind) =>
      rows.some((r) => r.kind === kind && !r.isActive);
    return {
      rules: await this.toDtos(userId, manual),
      auto: {
        goalEvents: !autoOff('goal_events'),
        dcaDue: !autoOff('dca_due'),
      },
    };
  }

  async create(
    userId: string,
    dto: CreateAlertRuleDto,
  ): Promise<AlertsOverviewDto> {
    let kind: AlertKind;
    let assetId: string | null = null;
    if (dto.kind === 'price' || dto.kind === 'asset_move') {
      const asset = await this.market.getAssetBySymbol(
        dto.assetSymbol!.toUpperCase(),
      );
      if (!asset) {
        throw new BadRequestException(
          `Activo ${dto.assetSymbol} no encontrado`,
        );
      }
      assetId = asset.id;
    }
    if (dto.portfolioId) {
      await this.portfolios.findOwnedOrThrow(userId, dto.portfolioId);
    }
    if (dto.kind === 'price') {
      const price = (await this.market.getPricesByAssetIds([assetId!])).get(
        assetId!,
      )?.price;
      if (!price) {
        throw new BadRequestException('Esa moneda no tiene precio para seguir');
      }
      // Avisar al llegar al precio: hacia arriba si hoy está por debajo.
      kind = dto.threshold > price ? 'price_above' : 'price_below';
    } else {
      kind = dto.kind;
    }
    await this.prisma.alertRule.create({
      data: {
        userId,
        kind,
        assetId,
        portfolioId: dto.portfolioId ?? null,
        threshold: dto.threshold,
        repeat: dto.kind === 'price' ? (dto.repeat ?? false) : true,
      },
    });
    return this.overview(userId);
  }

  async update(
    userId: string,
    ruleId: string,
    dto: UpdateAlertRuleDto,
  ): Promise<AlertsOverviewDto> {
    const rule = await this.findOwnedOrThrow(userId, ruleId);
    await this.prisma.alertRule.update({
      where: { id: rule.id },
      data: {
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.threshold !== undefined
          ? { threshold: dto.threshold, lastMet: false }
          : {}),
        ...(dto.repeat !== undefined ? { repeat: dto.repeat } : {}),
        updatedAt: new Date(),
      },
    });
    return this.overview(userId);
  }

  async remove(userId: string, ruleId: string): Promise<AlertsOverviewDto> {
    const rule = await this.findOwnedOrThrow(userId, ruleId);
    await this.prisma.alertRule.delete({ where: { id: rule.id } });
    return this.overview(userId);
  }

  // Avisos automáticos (metas y compras): sin fila están prendidos.
  async setAuto(
    userId: string,
    dto: SetAutoAlertDto,
  ): Promise<AlertsOverviewDto> {
    const existing = await this.prisma.alertRule.findFirst({
      where: { userId, kind: dto.kind },
    });
    if (existing) {
      await this.prisma.alertRule.update({
        where: { id: existing.id },
        data: { isActive: dto.enabled, updatedAt: new Date() },
      });
    } else if (!dto.enabled) {
      await this.prisma.alertRule.create({
        data: { userId, kind: dto.kind, isActive: false },
      });
    }
    return this.overview(userId);
  }

  private async findOwnedOrThrow(userId: string, ruleId: string) {
    const rule = await this.prisma.alertRule.findFirst({
      where: { id: ruleId, userId },
    });
    if (!rule || AUTO_KINDS.includes(rule.kind as AlertKind)) {
      throw new NotFoundException('Aviso no encontrado');
    }
    return rule;
  }

  private async toDtos(
    userId: string,
    rows: {
      id: string;
      kind: string;
      assetId: string | null;
      portfolioId: string | null;
      threshold: number | null;
      repeat: boolean;
      isActive: boolean;
      lastTriggeredAt: Date | null;
      createdAt: Date;
    }[],
  ): Promise<AlertRuleDto[]> {
    if (rows.length === 0) return [];
    const assetIds = [
      ...new Set(rows.map((r) => r.assetId).filter((a): a is string => !!a)),
    ];
    const [assets, portfolios] = await Promise.all([
      this.market.getAssetsByIds(assetIds),
      this.portfolios.list(userId),
    ]);
    const names = new Map(portfolios.map((p) => [p.id, p.name]));
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind as AlertKind,
      assetSymbol: r.assetId ? (assets.get(r.assetId)?.symbol ?? null) : null,
      portfolioId: r.portfolioId,
      portfolioName: r.portfolioId ? (names.get(r.portfolioId) ?? null) : null,
      threshold: r.threshold,
      repeat: r.repeat,
      isActive: r.isActive,
      lastTriggeredAt: r.lastTriggeredAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  // --- Centro de notificaciones ---

  async listNotifications(
    userId: string,
    limit = 30,
  ): Promise<{ items: NotificationDto[]; unreadCount: number }> {
    const [rows, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return {
      unreadCount,
      items: rows.map((n) => ({
        id: n.id,
        kind: n.kind,
        title: n.title,
        body: n.body,
        link: n.link,
        read: n.readAt !== null,
        createdAt: n.createdAt.toISOString(),
      })),
    };
  }

  async markRead(
    userId: string,
    ids?: string[],
  ): Promise<{ unreadCount: number }> {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null, ...(ids ? { id: { in: ids } } : {}) },
      data: { readAt: new Date() },
    });
    return {
      unreadCount: await this.prisma.notification.count({
        where: { userId, readAt: null },
      }),
    };
  }

  // Guarda los avisos nuevos (los repetidos se ignoran por dedupeKey) y los
  // manda por push a quien tenga dispositivos y no las haya apagado.
  async deliver(pending: PendingNotification[]): Promise<number> {
    if (pending.length === 0) return 0;
    const created = await this.prisma.notification.createManyAndReturn({
      data: pending,
      skipDuplicates: true,
    });
    if (created.length === 0) return 0;

    const userIds = [...new Set(created.map((n) => n.userId))];
    const [off, tokens] = await Promise.all([
      this.settings.usersWithNotificationsOff(userIds),
      this.devices.pushTokens(userIds),
    ]);
    const messages = created.flatMap((n) =>
      off.has(n.userId)
        ? []
        : (tokens.get(n.userId) ?? []).map((to) => ({
            to,
            title: n.title,
            body: n.body,
            data: { link: n.link, notificationId: n.id },
          })),
    );
    if (messages.length > 0) {
      const { invalidTokens } = await this.push.send(messages);
      await this.devices
        .removeByPushTokens(invalidTokens)
        .catch(() => undefined);
      const pushedIds = new Set(messages.map((m) => m.data.notificationId));
      await this.prisma.notification.updateMany({
        where: { id: { in: [...pushedIds] } },
        data: { pushedAt: new Date() },
      });
    }
    this.logger.log(
      `${created.length} aviso(s) nuevo(s), ${messages.length} push`,
    );
    return created.length;
  }

  // Borrado de cuenta: reglas y notificaciones del usuario.
  async purgeUser(userId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.notification.deleteMany({ where: { userId } }),
      this.prisma.alertRule.deleteMany({ where: { userId } }),
    ]);
  }
}
