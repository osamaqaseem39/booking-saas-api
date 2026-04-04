/**
 * Whether Nest TypeORM should run pending migrations on first DB connect.
 *
 * - Explicit `RUN_STARTUP_MIGRATIONS=true` → run.
 * - Explicit `RUN_STARTUP_MIGRATIONS=false` (or any other non-empty value) → do not run.
 * - Unset / empty → run only when `NODE_ENV === 'production'` (typical Vercel/Supabase).
 */
export function shouldRunStartupMigrations(): boolean {
  const raw = process.env.RUN_STARTUP_MIGRATIONS;
  if (raw !== undefined && String(raw).trim() !== '') {
    return String(raw).toLowerCase().trim() === 'true';
  }
  return process.env.NODE_ENV === 'production';
}
