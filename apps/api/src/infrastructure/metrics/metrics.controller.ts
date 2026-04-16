import { Controller, Get, Header } from '@nestjs/common';
import { collectDefaultMetrics, Counter, Registry } from 'prom-client';

const registry = new Registry();
collectDefaultMetrics({ register: registry });

const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP metric endpoint hits',
  registers: [registry],
});

@Controller('metrics')
export class MetricsController {
  @Get()
  @Header('Content-Type', registry.contentType)
  async getMetrics(): Promise<string> {
    httpRequestsTotal.inc();
    return registry.metrics();
  }
}
