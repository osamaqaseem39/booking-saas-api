import {
  collectDefaultMetrics,
  Histogram,
  Registry,
} from 'prom-client';

export const prometheusRegister = new Registry();

collectDefaultMetrics({
  register: prometheusRegister,
  prefix: 'nodejs_',
});

/** Histogram for API routes (path is normalized to reduce label cardinality). */
export const httpRequestDurationSeconds = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [prometheusRegister],
});
