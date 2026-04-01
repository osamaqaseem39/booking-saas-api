import { DataSource, DataSourceOptions } from 'typeorm';
import { join } from 'path';
import { CricketIndoorCourt } from '../modules/arena/cricket-indoor/entities/cricket-indoor-court.entity';
import { FutsalField } from '../modules/arena/futsal-field/entities/futsal-field.entity';
import { PadelCourt } from '../modules/arena/padel-court/entities/padel-court.entity';
import { TurfCourt } from '../modules/arena/turf-court/entities/turf-court.entity';
import { BookingItem } from '../modules/bookings/entities/booking-item.entity';
import { Booking } from '../modules/bookings/entities/booking.entity';
import { BusinessLocation } from '../modules/businesses/entities/business-location.entity';
import { BusinessMembership } from '../modules/businesses/entities/business-membership.entity';
import { Business } from '../modules/businesses/entities/business.entity';
import { Role } from '../modules/iam/entities/role.entity';
import { UserRole } from '../modules/iam/entities/user-role.entity';
import { User } from '../modules/iam/entities/user.entity';

function createTypeOrmOptions(): DataSourceOptions {
  const poolMax = Number(process.env.DB_POOL_MAX ?? 2);
  const poolIdleTimeoutMs = Number(process.env.DB_POOL_IDLE_MS ?? 10000);
  const poolConnectTimeoutMs = Number(process.env.DB_POOL_CONNECT_MS ?? 10000);
  const url = process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL;
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
      idleTimeoutMillis: poolIdleTimeoutMs,
      connectionTimeoutMillis: poolConnectTimeoutMs,
    },
  };
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
    CricketIndoorCourt,
    FutsalField,
    PadelCourt,
    TurfCourt,
    Booking,
    BookingItem,
  ],
  // Vercel/build setups differ on where compiled migration files land.
  // Include both the local src-relative location and dist-relative location.
  migrations: [
    join(__dirname, 'migrations', '*.js'),
    join(
      process.cwd(),
      'dist',
      'apps',
      'api',
      'database',
      'migrations',
      '*.js',
    ),
  ],
};

// Helpful in Vercel: confirms env vars are being applied (no secrets logged).
if (!(globalThis as any).__dbEnvLogged) {
  (globalThis as any).__dbEnvLogged = true;

  console.log(
    '[DB] host=',
    process.env.DB_HOST ?? 'localhost',
    'port=',
    process.env.DB_PORT ?? 5432,
    'db=',
    process.env.DB_NAME ?? 'backend_saas',
  );
}

export default new DataSource(typeOrmOptions);
