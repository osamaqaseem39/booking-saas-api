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
