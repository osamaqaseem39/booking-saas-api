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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-jwt-secret',
      signOptions: {
        expiresIn: (process.env.JWT_EXPIRES_IN ?? '1d') as any,
      },
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USERNAME ?? 'postgres',
      password: process.env.DB_PASSWORD ?? 'postgres',
      database: process.env.DB_NAME ?? 'backend_saas',
      autoLoadEntities: true,
      synchronize: (process.env.DB_SYNC ?? 'false') === 'true',
      ssl: (process.env.DB_SSL ?? 'false') === 'true',
    }),
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
