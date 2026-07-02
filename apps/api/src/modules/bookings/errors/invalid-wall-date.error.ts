export class InvalidWallDateError extends Error {
  readonly name = 'InvalidWallDateError';

  constructor(
    message: string,
    readonly context?: Record<string, unknown>,
  ) {
    super(message);
  }

  static forGridDate(
    operation: string,
    raw: unknown,
    normalized = '',
  ): InvalidWallDateError {
    const preview =
      raw instanceof Date
        ? raw.toISOString()
        : raw == null
          ? String(raw)
          : String(raw).slice(0, 80);
    return new InvalidWallDateError(
      `Invalid booking grid date during ${operation}: expected YYYY-MM-DD, received "${preview}"${
        normalized && normalized !== preview
          ? ` (normalized to "${normalized}")`
          : ''
      }`,
      { operation, raw: preview, normalized },
    );
  }
}
