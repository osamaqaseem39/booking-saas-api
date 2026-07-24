import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessLocation } from '../businesses/entities/business-location.entity';
import { IamModule } from '../iam/iam.module';
import { OptionalConsumerAuthGuard } from '../iam/authz/optional-consumer-auth.guard';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsEvent } from './entities/analytics-event.entity';

@Module({
  imports: [
    IamModule,
    TypeOrmModule.forFeature([AnalyticsEvent, BusinessLocation]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, OptionalConsumerAuthGuard],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
