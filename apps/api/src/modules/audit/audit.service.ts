import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditEvent } from './audit-event.entity';

export type AuditRecordInput = Pick<
  AuditEvent,
  | 'method'
  | 'path'
  | 'normalizedPath'
  | 'statusCode'
  | 'durationMs'
  | 'tenantId'
  | 'userId'
  | 'ip'
  | 'userAgent'
  | 'requestBody'
  | 'query'
  | 'errorMessage'
>;

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditEvent)
    private readonly auditRepository: Repository<AuditEvent>,
  ) {}

  /** Persists one row; failures are logged and never thrown to callers. */
  async record(input: AuditRecordInput): Promise<void> {
    try {
      const row = this.auditRepository.create(input);
      await this.auditRepository.save(row);
    } catch (err) {
      this.logger.warn(
        `audit_events insert failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
