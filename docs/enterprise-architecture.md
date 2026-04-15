# Enterprise NestJS Architecture (Supabase/PostgreSQL)

## Monorepo layout

```text
apps/
  api/
    src/
      infrastructure/
        config/
      modules/
        metrics/
        queue/
        users/
      bootstrap-enterprise.ts
      enterprise-app.module.ts
      main.ts
libs/
  auth/
    src/
  common/
    src/
      constants/
      filters/
      helpers/
      interceptors/
      pagination/
  database/
    src/
      redis/
```

## Layering rule

- Controller -> Service -> Repository
- DTO for input/output contracts
- Entity for persistence mapping
- Interfaces for domain contracts

## Runtime modules

- `DatabaseModule`: PostgreSQL TypeORM connection, Supabase-ready.
- `RedisModule`: Redis client for cache and queue infra.
- `AuthModule`: JWT access/refresh + guards + RBAC.
- `UsersModule`: production sample domain module.
- `QueueModule`: BullMQ workers for async workloads.
- `MetricsModule`: Prometheus-compatible metrics endpoint.

## Production notes

- Keep API stateless and run multiple app replicas behind a load balancer.
- Redis centralizes cache and queue state for horizontal scaling.
- Use Supabase connection pooler URL in `DATABASE_URL` for production.
- Add DB migration files for enterprise tables and indexes before go-live.
