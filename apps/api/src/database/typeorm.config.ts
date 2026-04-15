import { DataSource, DataSourceOptions } from 'typeorm';
import { join } from 'path';
import { GamingStation } from '../modules/arena/gaming-station/entities/gaming-station.entity';
import { PadelCourt } from '../modules/arena/padel-court/entities/padel-court.entity';
import { BookingItem } from '../modules/bookings/entities/booking-item.entity';
import { Booking } from '../modules/bookings/entities/booking.entity';
import { CourtFacilitySlot } from '../modules/bookings/entities/court-facility-slot.entity';
import { BusinessLocation } from '../modules/businesses/entities/business-location.entity';
import { BusinessMembership } from '../modules/businesses/entities/business-membership.entity';
import { Business } from '../modules/businesses/entities/business.entity';
import { Role } from '../modules/iam/entities/role.entity';
import { UserRole } from '../modules/iam/entities/user-role.entity';
import { User } from '../modules/iam/entities/user.entity';

function createTypeOrmOptions(): DataSourceOptions {
  const poolMax = resolvePoolMax();
  const poolIdleTimeoutMs = toPositiveInt(process.env.DB_POOL_IDLE_MS, 10000);
  const poolConnectTimeoutMs = toPositiveInt(
    process.env.DB_POOL_CONNECT_MS,
    10000,
  );
  const url = pickDatabaseUrl();
  if (url) {
    const parsed = new URL(url);
    const sslMode = parsed.searchParams.get('sslmode');
    return {
      type: 'postgres',
      host: parsed.hostname,
      port: Number(parsed.port || 5432),
      username: parsed.username,
      password: parsed.password,
      database: parsed.pathname.replace(/^\//, ''),
      ssl: sslMode === 'require' ? { rejectUnauthorized: false } : false,
      extra: {
        max: poolMax,
        min: 0,
        idleTimeoutMillis: poolIdleTimeoutMs,
        connectionTimeoutMillis: poolConnectTimeoutMs,
      },
    };
  }

  return {
    type: 'postgres',
    host: process.env.DB_HOST ?? process.env.POSTGRES_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    username:
      process.env.DB_USERNAME ?? process.env.POSTGRES_USER ?? 'postgres',
    password:
      process.env.DB_PASSWORD ?? process.env.POSTGRES_PASSWORD ?? 'postgres',
    database:
      process.env.DB_NAME ?? process.env.POSTGRES_DATABASE ?? 'backend_saas',
    extra: {
      max: poolMax,
      min: 0,
      idleTimeoutMillis: poolIdleTimeoutMs,
      connectionTimeoutMillis: poolConnectTimeoutMs,
    },
  };
}

function toPositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.floor(parsed);
}

function pickDatabaseUrl(): string | undefined {
  // Runtime should prefer pooled URL in serverless environments.
  return process.env.POSTGRES_URL ?? process.env.POSTGRES_URL_NON_POOLING;
}

function resolvePoolMax(): number {
  const configured = toPositiveInt(process.env.DB_POOL_MAX, 1);
  const isServerless =
    process.env.VERCEL === '1' ||
    process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined;
  const hardCap = isServerless ? 1 : 5;
  return Math.max(1, Math.min(configured, hardCap));
}

export const typeOrmOptions: DataSourceOptions = {
  ...createTypeOrmOptions(),
  entities: [
    User,
    Role,
    UserRole,
    Business,
    BusinessLocation,
    BusinessMembership,
    GamingStation,
    PadelCourt,
    Booking,
    BookingItem,
    CourtFacilitySlot,
  ],
  // Resolved from this file's directory (same for Nest and `migration:run -d dist/.../typeorm.config.js`).
  // Do not add a second glob to `dist/.../migrations` from `process.cwd()` — it matches the same files and
  // TypeORM throws "Duplicate migrations".
  migrations: [join(__dirname, 'migrations', '*.js')],
};

// Helpful in Vercel: confirms env vars are being applied (no secrets logged).
if (!(globalThis as any).__dbEnvLogged) {
  (globalThis as any).__dbEnvLogged = true;
  const loggedPoolMax = Number(process.env.DB_POOL_MAX ?? 1);

  console.log(
    '[DB] host=',
    process.env.DB_HOST ?? 'localhost',
    'port=',
    process.env.DB_PORT ?? 5432,
    'db=',
    process.env.DB_NAME ?? 'backend_saas',
    'poolMax=',
    loggedPoolMax,
  );
}

export default new DataSource(typeOrmOptions);
