import { HttpException, Logger } from '@nestjs/common';

/** Logs booking-create failures to stdout/stderr (visible in Vercel function logs). */
export function logBookingsCreateFailure(
  logger: Logger,
  operation: string,
  err: unknown,
): void {
  if (err instanceof HttpException) {
    const status = err.getStatus();
    const msg = `[${operation}] HTTP ${status}: ${err.message}`;
    if (status >= 500) {
      logger.error(msg, err.stack);
    } else {
      logger.warn(msg);
    }
    return;
  }
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  logger.error(`[${operation}] ${message}`, stack);
}
