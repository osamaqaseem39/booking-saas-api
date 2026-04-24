import { HttpException, Logger } from '@nestjs/common';

/**
 * Non-Http errors rethrown from create handlers. HttpException (4xx/5xx) is already
 * logged by ApiExceptionFilter, including failures from ValidationPipe before the handler runs.
 */
export function logBookingsCreateFailure(
  logger: Logger,
  operation: string,
  err: unknown,
): void {
  if (err instanceof HttpException) {
    return;
  }
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  logger.error(`[${operation}] ${message}`, stack);
}
