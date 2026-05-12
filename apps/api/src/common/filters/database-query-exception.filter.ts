import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

type PgDriverError = {
  code?: string;
  detail?: string;
  message?: string;
};


@Catch(QueryFailedError)
export class DatabaseQueryExceptionFilter
  implements ExceptionFilter<QueryFailedError>
{
  private readonly logger = new Logger(DatabaseQueryExceptionFilter.name);

  catch(exception: QueryFailedError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const driver = (exception as QueryFailedError & { driverError?: PgDriverError })
      .driverError;
    const code = (driver?.code ?? '').trim();
    const lowerMessage = `${exception.message ?? ''}`.toLowerCase();

    const schemaOutOfDate =
      code === '42P01' ||
      code === '42703' ||
      lowerMessage.includes('does not exist');

    const statusCode = schemaOutOfDate
      ? HttpStatus.SERVICE_UNAVAILABLE
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = schemaOutOfDate
      ? 'Database schema is out of date. Run migrations and retry.'
      : 'Database query failed while processing request.';

    this.logger.error(
      `[${code || 'unknown'}] ${req.method} ${req.url} -> ${exception.message}`,
    );

    res.status(statusCode).json({
      statusCode,
      error: schemaOutOfDate ? 'Service Unavailable' : 'Internal Server Error',
      message,
      timestamp: new Date().toISOString(),
      path: req.url,
    });
  }
}
