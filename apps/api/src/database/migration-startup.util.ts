/**
 * Whether Nest TypeORM should run pending migrations on first DB connect.
 *
 * - Explicit `RUN_STARTUP_MIGRATIONS=true` → run.
 * - Explicit `RUN_STARTUP_MIGRATIONS=false` (or any other non-empty value) → do not run.
 * - Unset / empty:
 *   - serverless env (Vercel/AWS Lambda) → do not run (prevents pool spikes on cold starts)
 *   - otherwise run only when `NODE_ENV === 'production'`.
 */
export function shouldRunStartupMigrations(): boolean {
  const raw = process.env.RUN_STARTUP_MIGRATIONS;
  if (raw !== undefined && String(raw).trim() !== '') {
    return String(raw).toLowerCase().trim() === 'true';
  }
  const isServerless =
    process.env.VERCEL === '1' ||
    process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined;
  if (isServerless) {
    return false;
  }
  return process.env.NODE_ENV === 'production';
}
