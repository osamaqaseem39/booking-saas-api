import { Controller, Get, Header } from '@nestjs/common';
import { prometheusRegister } from './prometheus.registry';

@Controller('metrics')
export class HttpMetricsController {
  @Get()
  @Header('Content-Type', prometheusRegister.contentType)
  async scrape(): Promise<string> {
    return prometheusRegister.metrics();
  }
}
