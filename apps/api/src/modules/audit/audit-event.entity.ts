import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'audit_events' })
@Index('idx_audit_events_occurred', ['occurredAt'])
@Index('idx_audit_events_tenant', ['tenantId'])
@Index('idx_audit_events_user', ['userId'])
export class AuditEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'occurredAt' })
  occurredAt!: Date;

  @Column({ type: 'varchar', length: 12 })
  method!: string;

  @Column({ type: 'text' })
  path!: string;

  @Column({ type: 'text', name: 'normalizedPath' })
  normalizedPath!: string;

  @Column({ type: 'int', name: 'statusCode' })
  statusCode!: number;

  @Column({ type: 'int', name: 'durationMs' })
  durationMs!: number;

  @Column({ type: 'varchar', length: 64, nullable: true, name: 'tenantId' })
  tenantId?: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'userId' })
  userId?: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip?: string | null;

  @Column({ type: 'text', nullable: true, name: 'userAgent' })
  userAgent?: string | null;

  @Column({ type: 'jsonb', nullable: true, name: 'requestBody' })
  requestBody?: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  query?: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true, name: 'errorMessage' })
  errorMessage?: string | null;
}
