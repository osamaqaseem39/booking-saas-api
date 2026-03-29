# backend-saas

New NestJS backend scaffold for a multi-tenant booking + billing SaaS platform,
separate from `backend`.

## Business scope

Primary business types:

- Arena
  - cricket indoor
  - futsal field
  - padel court
- Gaming zone
  - PC
  - PS5
  - PS4

Upcoming:

- Snooker
- Table tennis

## Current architecture

- `apps/api/src/tenancy`
  - Tenant context middleware (`x-tenant-id`) and tenant decorator
- `apps/api/src/modules/iam`
  - Main users and multi-role assignment with role guard
- `apps/api/src/modules/businesses`
  - Business onboarding with mandatory admin creation and membership
- `apps/api/src/modules/product-catalog`
  - Canonical product verticals and offerings
- `apps/api/src/modules/arena`
  - **Arena** vertical: one Nest module per sub-facility type (DB-backed)
  - `cricket-indoor` → `cricket_indoor_courts`
  - `futsal-field` → `futsal_fields`
  - `padel-court` → `padel_courts`
- `apps/api/src/modules/facility-catalog`
  - Generic facility types (still in-memory scaffold)
- `apps/api/src/modules/bookings`
  - Tenant-scoped booking APIs
- `apps/api/src/modules/billing`
  - Tenant-scoped invoice APIs
- `apps/api/src/health`
  - Health endpoint

## API endpoints (starter)

- `GET /health`
- `GET /iam/users`
- `POST /iam/users`
- `POST /iam/roles/assign`
- `GET /businesses`
- `POST /businesses/onboard`
- `GET /product-catalog`
- `GET /arena` — meta (vertical + sub-type route map)
- `GET|POST|PATCH|DELETE /arena/turf-courts` — **combined Futsal + Cricket turf setup** (full form fields: structure, dimensions, surface, per-sport settings, pricing, slots, amenities, rules). Each court has **`sportMode`**: `futsal_only` \| `cricket_only` \| `both` (synced with `supportsFutsal` / `supportsCricket`). List filter: `GET /arena/turf-courts?sport=futsal` or `?sport=cricket` returns only courts that support that sport.
- `GET|POST|PATCH|DELETE /arena/cricket-indoor` (+ `GET :id`)
- `GET|POST|PATCH|DELETE /arena/futsal-field` (+ `GET :id`)
- `GET|POST|PATCH|DELETE /arena/padel-court` (+ `GET :id`) — **padel setup form** (structure, glass walls, dimensions ~20×10m defaults, surface, match type, pricing, slots, extras, amenities, rules)
- `GET /facility-types`
- `POST /facility-types`
- `GET /sub-facility-types`
- `POST /sub-facility-types`
- `GET /bookings`
- `POST /bookings`
- `GET /billing/invoices`
- `POST /billing/invoices`

Role-protected endpoints use header:

- `x-user-id: <uuid>`

Arena CRUD (create/update/delete) requires `platform-owner` or `business-admin`.
Send the business **`tenantId`** as `x-tenant-id` (from onboarding response).

- `x-tenant-id: <business tenant uuid>`

## User data model (table plan)

Recommended user-related tables for your roles model:

1. `users` (single main users table for Platform Owner, Business, Customer/End User)
2. `roles` (role catalog)
3. `user_roles` (many-to-many mapping for multi-role users)
4. `business_memberships` (links users to businesses with tenant-level role)

Business user is not a separate user table. It is the same `users` table plus
role and membership mappings.

## Implemented database entities

- `users`
- `roles`
- `user_roles`
- `businesses`
- `business_memberships`
- `turf_courts` (Futsal + Cricket combined configuration)
- `cricket_indoor_courts`
- `futsal_fields`
- `padel_courts` (extended columns for padel setup form)

## Mandatory business onboarding flow

`POST /businesses/onboard` now performs:

1. Create business with `tenantId`
2. Create-or-reuse admin user by email
3. Assign `business-admin` system role
4. Create business membership with `owner` role

## Run

```bash
npm install
npm run start:dev
```

## Next implementation steps

1. Replace remaining in-memory modules (facility-catalog, bookings, billing) with TypeORM.
2. Add auth + tenant-scoped RBAC (owner, manager, staff).
3. Add booking pricing engine (peak/off-peak, weekend, sport-specific slots).
4. Add billing workflows (tax, discounts, payment integrations, reconciliation).
5. Add reporting module (occupancy, revenue, utilization by sub-facility type).
