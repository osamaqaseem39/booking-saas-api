import {
  ForbiddenException,
  Injectable,
  Logger,
  PayloadTooLargeException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { BusinessLocation } from '../businesses/entities/business-location.entity';
import { IamService } from '../iam/iam.service';
import {
  ANALYTICS_MAX_BATCH_SIZE,
  ANALYTICS_RETENTION_DAYS,
  AnalyticsEventInput,
  hashSourceIp,
  outcomeFromEvent,
  validateAnalyticsEvent,
} from './analytics.utils';
import { isVendorEventName } from './analytics-event-catalog';
import { AnalyticsEvent } from './entities/analytics-event.entity';

type IngestItemError = {
  index: number;
  event_id?: string;
  error: string;
};

type IngestBatchInput = {
  tenantId?: string | null;
  userId?: string | null;
  events: AnalyticsEventInput[];
  sourceIp?: string | null;
  userAgent?: string | null;
  source?: 'mobile_client' | 'backend';
};

type EmitServerEventInput = {
  eventName: string;
  tenantId?: string | null;
  userId?: string | null;
  locationId?: string | null;
  properties: Record<string, unknown>;
  screenName?: string;
};

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(AnalyticsEvent)
    private readonly events: Repository<AnalyticsEvent>,
    @InjectRepository(BusinessLocation)
    private readonly locations: Repository<BusinessLocation>,
    private readonly iamService: IamService,
  ) {}

  async ingestBatch(input: IngestBatchInput) {
    if (input.events.length > ANALYTICS_MAX_BATCH_SIZE) {
      throw new PayloadTooLargeException(
        `Batch exceeds maximum size of ${ANALYTICS_MAX_BATCH_SIZE} events`,
      );
    }

    const sourceIpHash = hashSourceIp(input.sourceIp);
    const userAgent = (input.userAgent ?? '').trim().slice(0, 400) || null;
    const source = input.source ?? 'mobile_client';
    const errors: IngestItemError[] = [];
    let accepted = 0;

    for (let index = 0; index < input.events.length; index++) {
      const raw = input.events[index]!;
      const validated = validateAnalyticsEvent(raw, index);
      if (!validated.ok) {
        errors.push({
          index,
          event_id: raw.event_id,
          error: validated.error,
        });
        continue;
      }

      if (isVendorEventName(validated.value.eventName)) {
        if (!input.tenantId) {
          errors.push({
            index,
            event_id: raw.event_id,
            error: 'vendor events require a valid X-Tenant-Id header',
          });
          continue;
        }
        if (!input.userId) {
          errors.push({
            index,
            event_id: raw.event_id,
            error: 'vendor events require authentication',
          });
          continue;
        }
      }

      const tenantId = await this.resolveTenantId(
        input.tenantId,
        validated.value.locationIdFromProperties,
      );
      const locationId = await this.resolveLocationId(
        tenantId,
        validated.value.locationIdFromProperties,
      );

      const inserted = await this.insertEvent({
        eventId: validated.value.eventId,
        eventName: validated.value.eventName,
        occurredAt: validated.value.occurredAt,
        userId: input.userId ?? null,
        tenantId,
        anonymousId: validated.value.anonymousId,
        locationId,
        sessionId: validated.value.sessionId,
        screenName: validated.value.screenName,
        source,
        platform: validated.value.platform,
        appVersion: validated.value.appVersion,
        appBuild: validated.value.appBuild,
        sourceIpHash,
        userAgent,
        properties: validated.value.properties,
        context: validated.value.context,
      });

      if (!inserted.ok) {
        errors.push({
          index,
          event_id: validated.value.eventId,
          error: inserted.reason,
        });
        continue;
      }

      accepted += 1;
    }

    return {
      accepted_count: accepted,
      rejected_count: errors.length,
      errors,
    };
  }

  emitServerEvent(input: EmitServerEventInput): void {
    void this.persistServerEvent(input).catch((err) => {
      this.logger.warn(
        `server analytics emit failed (${input.eventName}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    });
  }

  private async persistServerEvent(input: EmitServerEventInput): Promise<void> {
    const eventId = randomUUID();
    const validated = validateAnalyticsEvent(
      {
        event_id: eventId,
        event_name: input.eventName,
        occurred_at: new Date().toISOString(),
        anonymous_id: 'server',
        session_id: 'server',
        screen_name: input.screenName ?? 'server',
        properties: input.properties,
        context: { platform: 'backend' },
      },
      0,
    );
    if (!validated.ok) {
      this.logger.warn(`server analytics validation failed: ${validated.error}`);
      return;
    }

    const tenantId = await this.resolveTenantId(
      input.tenantId ?? null,
      input.locationId ?? validated.value.locationIdFromProperties,
    );
    const locationId = await this.resolveLocationId(
      tenantId,
      input.locationId ?? validated.value.locationIdFromProperties,
    );

    await this.insertEvent({
      eventId: validated.value.eventId,
      eventName: validated.value.eventName,
      occurredAt: validated.value.occurredAt,
      userId: input.userId ?? null,
      tenantId,
      anonymousId: null,
      locationId,
      sessionId: null,
      screenName: input.screenName ?? 'server',
      source: 'backend',
      platform: 'backend',
      appVersion: null,
      appBuild: null,
      sourceIpHash: null,
      userAgent: null,
      properties: validated.value.properties,
      context: validated.value.context,
    });
  }

  private async insertEvent(row: {
    eventId: string;
    eventName: string;
    occurredAt: Date;
    userId: string | null;
    tenantId: string | null;
    anonymousId: string | null;
    locationId: string | null;
    sessionId: string | null;
    screenName: string | null;
    source: string;
    platform: string | null;
    appVersion: string | null;
    appBuild: string | null;
    sourceIpHash: string | null;
    userAgent: string | null;
    properties: Record<string, unknown>;
    context: Record<string, unknown>;
  }): Promise<{ ok: true } | { ok: false; reason: string }> {
    try {
      const insertResult = await this.events
        .createQueryBuilder()
        .insert()
        .into(AnalyticsEvent)
        .values({
          eventId: row.eventId,
          eventName: row.eventName,
          occurredAt: row.occurredAt,
          userId: row.userId,
          tenantId: row.tenantId,
          anonymousId: row.anonymousId,
          locationId: row.locationId,
          sessionId: row.sessionId,
          screenName: row.screenName,
          source: row.source,
          platform: row.platform,
          appVersion: row.appVersion,
          appBuild: row.appBuild,
          sourceIpHash: row.sourceIpHash,
          userAgent: row.userAgent,
          properties: row.properties,
          context: row.context,
          schemaVersion: 1,
        } as never)
        .orIgnore()
        .execute();

      const inserted =
        (insertResult.raw?.length ?? 0) > 0 ||
        (insertResult.identifiers?.length ?? 0) > 0;
      if (inserted) return { ok: true };

      const existing = await this.events.findOne({
        where: { eventId: row.eventId },
        select: ['id', 'tenantId', 'userId', 'anonymousId'],
      });
      if (!existing) {
        return { ok: false, reason: 'event_id insert failed' };
      }

      const tenantMismatch =
        row.tenantId &&
        existing.tenantId &&
        existing.tenantId !== row.tenantId;
      const userMismatch =
        row.userId && existing.userId && existing.userId !== row.userId;
      if (tenantMismatch || userMismatch) {
        return {
          ok: false,
          reason: 'event_id already exists for a different scope',
        };
      }

      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        reason: err instanceof Error ? err.message : 'insert failed',
      };
    }
  }

  async getReport(input: {
    tenantId: string;
    requesterUserId: string;
    from: string;
    to: string;
    eventName?: string;
    locationId?: string;
    appVersion?: string;
  }) {
    await this.assertReportAccess(input.requesterUserId, input.tenantId, input.locationId);

    const from = new Date(input.from);
    const to = new Date(input.to);
    const qb = this.events
      .createQueryBuilder('e')
      .where('e.tenantId = :tenantId', { tenantId: input.tenantId })
      .andWhere('e.occurredAt >= :from', { from })
      .andWhere('e.occurredAt <= :to', { to });

    if (input.eventName) {
      qb.andWhere('e.eventName = :eventName', { eventName: input.eventName });
    }
    if (input.locationId) {
      qb.andWhere('e.locationId = :locationId', { locationId: input.locationId });
    }
    if (input.appVersion) {
      qb.andWhere('e.appVersion = :appVersion', { appVersion: input.appVersion });
    }

    const rows = await qb.getMany();
    const uniqueUsers = new Set(rows.map((r) => r.userId).filter(Boolean));

    const byEventName = new Map<
      string,
      { count: number; users: Set<string>; completed: number; failed: number; attempted: number }
    >();
    const byAppVersion = new Map<string, number>();
    const byLocation = new Map<string, number>();
    const byPlatform = new Map<string, number>();

    for (const row of rows) {
      const bucket =
        byEventName.get(row.eventName) ??
        ({
          count: 0,
          users: new Set<string>(),
          completed: 0,
          failed: 0,
          attempted: 0,
        } as const);
      const next = {
        count: bucket.count + 1,
        users: new Set(bucket.users),
        completed: bucket.completed,
        failed: bucket.failed,
        attempted: bucket.attempted,
      };
      if (row.userId) next.users.add(row.userId);
      const outcome = outcomeFromEvent(row.eventName, row.properties);
      if (outcome === 'completed') next.completed += 1;
      if (outcome === 'failed') next.failed += 1;
      if (outcome === 'attempted') next.attempted += 1;
      byEventName.set(row.eventName, next);

      const versionKey = row.appVersion ?? 'unknown';
      byAppVersion.set(versionKey, (byAppVersion.get(versionKey) ?? 0) + 1);

      const locationKey = row.locationId ?? 'unknown';
      byLocation.set(locationKey, (byLocation.get(locationKey) ?? 0) + 1);

      const platformKey = row.platform ?? 'unknown';
      byPlatform.set(platformKey, (byPlatform.get(platformKey) ?? 0) + 1);
    }

    const eventBreakdown = [...byEventName.entries()]
      .map(([event_name, stats]) => {
        const denom = stats.completed + stats.failed;
        return {
          event_name,
          count: stats.count,
          unique_users: stats.users.size,
          attempted: stats.attempted,
          completed: stats.completed,
          failed: stats.failed,
          success_rate: denom > 0 ? Number((stats.completed / denom).toFixed(4)) : null,
        };
      })
      .sort((a, b) => b.count - a.count);

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      tenant_id: input.tenantId,
      total_events: rows.length,
      unique_users: uniqueUsers.size,
      retention_policy_days: ANALYTICS_RETENTION_DAYS,
      by_event_name: eventBreakdown,
      by_app_version: mapCounts(byAppVersion),
      by_location: mapCounts(byLocation),
      by_platform: mapCounts(byPlatform),
      booking_funnel: this.buildBookingFunnel(rows),
    };
  }

  private buildBookingFunnel(rows: AnalyticsEvent[]) {
    const consumerSteps = [
      'venue_details_viewed',
      'booking_started',
      'begin_checkout',
      'booking_created_server',
    ] as const;
    const vendorSteps = [
      'booking_create_started',
      'booking_create_completed',
      'booking_create_failed',
    ] as const;

    const consumerCounts = Object.fromEntries(
      consumerSteps.map((step) => [step, 0]),
    ) as Record<(typeof consumerSteps)[number], number>;
    const vendorCounts = Object.fromEntries(
      vendorSteps.map((step) => [step, 0]),
    ) as Record<(typeof vendorSteps)[number], number>;

    for (const row of rows) {
      if ((consumerSteps as readonly string[]).includes(row.eventName)) {
        consumerCounts[row.eventName as (typeof consumerSteps)[number]] += 1;
      }
      if ((vendorSteps as readonly string[]).includes(row.eventName)) {
        vendorCounts[row.eventName as (typeof vendorSteps)[number]] += 1;
      }
    }

    const vendorDenom =
      vendorCounts.booking_create_completed + vendorCounts.booking_create_failed;

    return {
      consumer: {
        venue_details_viewed: consumerCounts.venue_details_viewed,
        booking_started: consumerCounts.booking_started,
        begin_checkout: consumerCounts.begin_checkout,
        booking_created_server: consumerCounts.booking_created_server,
        conversion_rate:
          consumerCounts.venue_details_viewed > 0
            ? Number(
                (
                  consumerCounts.booking_created_server /
                  consumerCounts.venue_details_viewed
                ).toFixed(4),
              )
            : null,
      },
      vendor: {
        started: vendorCounts.booking_create_started,
        completed: vendorCounts.booking_create_completed,
        failed: vendorCounts.booking_create_failed,
        conversion_rate:
          vendorCounts.booking_create_started > 0
            ? Number(
                (
                  vendorCounts.booking_create_completed /
                  vendorCounts.booking_create_started
                ).toFixed(4),
              )
            : null,
        success_rate:
          vendorDenom > 0
            ? Number((vendorCounts.booking_create_completed / vendorDenom).toFixed(4))
            : null,
      },
    };
  }

  private async resolveTenantId(
    headerTenantId: string | null | undefined,
    locationId: string | null,
  ): Promise<string | null> {
    if (headerTenantId && /^[0-9a-f-]{36}$/i.test(headerTenantId)) {
      return headerTenantId;
    }
    if (!locationId) return null;
    const row = await this.locations.findOne({
      where: { id: locationId },
      relations: ['business'],
    });
    return row?.business?.tenantId ?? null;
  }

  private async resolveLocationId(
    tenantId: string | null,
    fromProperties: string | null,
  ): Promise<string | null> {
    if (!fromProperties) return null;
    if (!tenantId) return fromProperties;
    const allowed = await this.locationBelongsToTenant(fromProperties, tenantId);
    return allowed ? fromProperties : null;
  }

  private async locationBelongsToTenant(
    locationId: string,
    tenantId: string,
  ): Promise<boolean> {
    const row = await this.locations.findOne({
      where: { id: locationId },
      relations: ['business'],
    });
    return row?.business?.tenantId === tenantId;
  }

  private async assertReportAccess(
    requesterUserId: string,
    tenantId: string,
    locationId?: string,
  ) {
    const me = await this.iamService.getMe(requesterUserId);
    const isPlatformOwner = me.roles.includes('platform-owner');
    if (isPlatformOwner) return;

    if (!me.tenantId || me.tenantId !== tenantId) {
      throw new ForbiddenException('Tenant scope mismatch');
    }

    if (locationId && me.locationId && me.locationId !== locationId) {
      const allowed = await this.locationBelongsToTenant(locationId, tenantId);
      if (!allowed) {
        throw new ForbiddenException('Location is outside tenant scope');
      }
      if (!me.roles.includes('business-admin') && me.locationId !== locationId) {
        throw new ForbiddenException('Location scope mismatch');
      }
    }
  }
}

function mapCounts(map: Map<string, number>) {
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}
