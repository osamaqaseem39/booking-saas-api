import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'analytics_events' })
@Index('idx_analytics_events_tenant_occurred', ['tenantId', 'occurredAt'])
@Index('idx_analytics_events_name_occurred', ['eventName', 'occurredAt'])
@Index('idx_analytics_events_location_occurred', ['locationId', 'occurredAt'])
@Index('idx_analytics_events_user_occurred', ['userId', 'occurredAt'])
@Index('idx_analytics_events_anonymous_occurred', ['anonymousId', 'occurredAt'])
@Index('idx_analytics_events_session', ['sessionId', 'occurredAt'])
export class AnalyticsEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  eventId!: string;

  @Column({ type: 'varchar', length: 64 })
  eventName!: string;

  @Column({ type: 'timestamptz' })
  occurredAt!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  receivedAt!: Date;

  @Column({ type: 'uuid', nullable: true })
  userId?: string | null;

  @Column({ type: 'uuid', nullable: true })
  tenantId?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  anonymousId?: string | null;

  @Column({ type: 'uuid', nullable: true })
  locationId?: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  sessionId?: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  screenName?: string | null;

  @Column({ type: 'varchar', length: 16, default: 'mobile_client' })
  source!: string;

  @Column({ type: 'varchar', length: 16, nullable: true })
  platform?: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  appVersion?: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  appBuild?: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  sourceIpHash?: string | null;

  @Column({ type: 'varchar', length: 400, nullable: true })
  userAgent?: string | null;

  @Column({ type: 'jsonb', default: {} })
  properties!: Record<string, unknown>;

  @Column({ type: 'jsonb', default: {} })
  context!: Record<string, unknown>;

  @Column({ type: 'smallint', default: 1 })
  schemaVersion!: number;
}
