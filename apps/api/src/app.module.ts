import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthModule } from './health/health.module';
import { ArenaModule } from './modules/arena/arena.module';
import { BillingModule } from './modules/billing/billing.module';
import { BusinessesModule } from './modules/businesses/businesses.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { FacilityCatalogModule } from './modules/facility-catalog/facility-catalog.module';
import { AuthModule } from './modules/auth/auth.module';
import { IamModule } from './modules/iam/iam.module';
import { ProductCatalogModule } from './modules/product-catalog/product-catalog.module';
import { TenancyModule } from './tenancy/tenancy.module';


function createTypeOrmConfig() {
  const poolMax = Number(process.env.DB_POOL_MAX ?? 1);
  const poolIdleTimeoutMs = Number(process.env.DB_POOL_IDLE_MS ?? 10000);
  const poolConnectTimeoutMs = Number(process.env.DB_POOL_CONNECT_MS ?? 10000);
  const url = process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL;
  if (url) {
    const parsed = new URL(url);
    const sslMode = parsed.searchParams.get('sslmode');
    const cfg = {
      type: 'postgres' as const,
      host: parsed.hostname,
      port: Number(parsed.port || 5432),
      username: parsed.username,
      password: parsed.password,
      database: parsed.pathname.replace(/^\//, ''),
      autoLoadEntities: true,
      synchronize: (process.env.DB_SYNC ?? 'false') === 'true',
      ssl: sslMode === 'require' ? { rejectUnauthorized: false } : false,
      extra: {
        max: poolMax,
        idleTimeoutMillis: poolIdleTimeoutMs,
        connectionTimeoutMillis: poolConnectTimeoutMs,
      },
    };
    if (!(globalThis as any).__dbEnvLogged) {
      (globalThis as any).__dbEnvLogged = true;

      console.log(
        '[DB] host=',
        cfg.host,
        'port=',
        cfg.port,
        'db=',
        cfg.database,
        'poolMax=',
        poolMax,
      );
    }
    return cfg;
  }

  // Fallback: explicit DB_* vars
  const cfg = {
    type: 'postgres' as const,
    host: process.env.DB_HOST ?? process.env.POSTGRES_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    username:
      process.env.DB_USERNAME ?? process.env.POSTGRES_USER ?? 'postgres',
    password:
      process.env.DB_PASSWORD ?? process.env.POSTGRES_PASSWORD ?? 'postgres',
    database:
      process.env.DB_NAME ?? process.env.POSTGRES_DATABASE ?? 'backend_saas',
    autoLoadEntities: true,
    synchronize: (process.env.DB_SYNC ?? 'false') === 'true',
    ssl:
      process.env.DB_SSL === 'true'
        ? { rejectUnauthorized: false }
        : sslModeFromEnv(),
    extra: {
      max: poolMax,
      idleTimeoutMillis: poolIdleTimeoutMs,
      connectionTimeoutMillis: poolConnectTimeoutMs,
    },
  };
  if (!(globalThis as any).__dbEnvLogged) {
    (globalThis as any).__dbEnvLogged = true;

    console.log('[DB] host=', cfg.host, 'port=', cfg.port, 'db=', cfg.database);
    console.log(
      '[DB] poolMax=',
      poolMax,
      'idleMs=',
      poolIdleTimeoutMs,
      'connectMs=',
      poolConnectTimeoutMs,
    );
  }
  return cfg;
}

function sslModeFromEnv() {
  // In Supabase, SSL is typically required when using pooler URLs.
  // If DB_SSL is not set, default to enabling SSL when the pooler URL is used.
  const url = process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL;
  if (!url) return false;
  const parsed = new URL(url);
  const sslMode = parsed.searchParams.get('sslmode');
  return sslMode === 'require' ? { rejectUnauthorized: false } : false;
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({
      secret:
        process.env.JWT_SECRET ??
        process.env.SUPABASE_JWT_SECRET ??
        process.env.SUPABASE_SECRET_KEY ??
        'dev-jwt-secret',
      signOptions: {
        expiresIn: (process.env.JWT_EXPIRES_IN ?? '1d') as any,
      },
    }),
    TypeOrmModule.forRoot(createTypeOrmConfig()),
    TenancyModule,
    HealthModule,
    ArenaModule,
    AuthModule,
    IamModule,
    BusinessesModule,
    ProductCatalogModule,
    FacilityCatalogModule,
    BookingsModule,
    BillingModule,
  ],
})
export class AppModule {}
