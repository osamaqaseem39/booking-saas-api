import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  private isDatabasePoolTimeout(exception: unknown): boolean {
    if (!exception || typeof exception !== 'object') return false;
    const maybe = exception as {  
      message?: unknown;
      code?: unknown;
      driverError?: { message?: unknown; code?: unknown };
    };
    const message = String(maybe.message ?? '').toLowerCase();
    const driverMessage = String(maybe.driverError?.message ?? '').toLowerCase();
    const code = String(maybe.code ?? maybe.driverError?.code ?? '').toUpperCase();
    return (
      message.includes('timeout exceeded when trying to connect') ||
      message.includes('unable to check out connection from the pool') ||
      driverMessage.includes('unable to check out connection from the pool') ||
      code === 'ECHECKOUTTIMEOUT'
    );
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const payload = exception.getResponse();
      const defaultMessage = exception.message || 'Request failed';

      let message: string | string[] = defaultMessage;
      let error: string | undefined;

      if (typeof payload === 'string') {
        message = payload;
      } else if (payload && typeof payload === 'object') {
        const maybeMessage = (payload as { message?: unknown }).message;
        const maybeError = (payload as { error?: unknown }).error;
        if (typeof maybeMessage === 'string' || Array.isArray(maybeMessage)) {
          message = maybeMessage;
        }
        if (typeof maybeError === 'string') {
          error = maybeError;
        }
      }

      // ValidationPipe, guards, and BadRequest from handlers — visible in Vercel function logs
      const logDetail = Array.isArray(message)
        ? message.join(' | ')
        : String(message);
      if (statusCode >= 500) {
        this.logger.error(
          `HTTP ${statusCode} ${req.method} ${req.url} — ${logDetail}`,
          exception.stack,
        );
      } else {
        this.logger.warn(
          `HTTP ${statusCode} ${req.method} ${req.url} — ${logDetail}`,
        );
      }

      res.status(statusCode).json({
        statusCode,
        error: error ?? this.httpStatusLabel(statusCode),
        message,
        timestamp: new Date().toISOString(),
        path: req.url,
      });
      return;
    }

    this.logger.error(
      `Unhandled exception on ${req.method} ${req.url}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    if (this.isDatabasePoolTimeout(exception)) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        error: 'Service Unavailable',
        message: 'Database is temporarily busy. Please retry shortly.',
        timestamp: new Date().toISOString(),
        path: req.url,
      });
      return;
    }

    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Something went wrong while processing request.',
      timestamp: new Date().toISOString(),
      path: req.url,
    });
  }

  private httpStatusLabel(statusCode: number): string {
    switch (statusCode) {
      case HttpStatus.BAD_REQUEST:
        return 'Bad Request';
      case HttpStatus.UNAUTHORIZED:
        return 'Unauthorized';
      case HttpStatus.FORBIDDEN:
        return 'Forbidden';
      case HttpStatus.NOT_FOUND:
        return 'Not Found';
      case HttpStatus.CONFLICT:
        return 'Conflict';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'Unprocessable Entity';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'Too Many Requests';
      case HttpStatus.SERVICE_UNAVAILABLE:
        return 'Service Unavailable';
      default:
        return 'Error';
    }
  }
}
