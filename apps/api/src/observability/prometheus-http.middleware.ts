import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { normalizeHttpPath } from '../modules/audit/audit.utils';
import { httpRequestDurationSeconds } from './prometheus.registry';

@Injectable()
export class PrometheusHttpMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    if (req.method === 'OPTIONS') {
      next();
      return;
    }

    const rawPath = (req.path || req.url || '').split('?')[0] || '/';
    if (rawPath === '/metrics') {
      next();
      return;
    }

    const path = normalizeHttpPath(rawPath);
    const method = (req.method || 'GET').toUpperCase();
    const endTimer = httpRequestDurationSeconds.startTimer({ method, path });

    res.on('finish', () => {
      endTimer({ status: String(res.statusCode ?? 0) });
    });

    next();
  }
}
