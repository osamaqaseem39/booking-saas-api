import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { HttpMetricsController } from './http-metrics.controller';
import { PrometheusHttpMiddleware } from './prometheus-http.middleware';

@Module({
  controllers: [HttpMetricsController],
  providers: [PrometheusHttpMiddleware],
})
export class HttpMetricsModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(PrometheusHttpMiddleware).forRoutes('*');
  }
}
