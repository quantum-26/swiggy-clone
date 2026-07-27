# PROGRESS.md

## Week 1

### Day 1
- Docker Compose skeleton (Postgres, Redis, user-service) running
- Repo structure scaffolded for all 6 services (stubs)
- user-service health/ready checks working

### Day 2
- users table schema + migration
- signup/login endpoints (routes → controllers → services → repositories)
- bcrypt password hashing, JWT access+refresh token issuing
- Refresh token in httpOnly cookie — confirmed 201/200 via curl

### Day 3
- api-gateway built as Express reverse-proxy to user-service (`http-proxy-middleware`)
- JWT verification middleware at the gateway edge (access secret only —
  refresh secret never exposed to gateway, deliberate security boundary)
- Centralized error-handling middleware, matching user-service's shape
- [B] Refresh-token rotation implemented from scratch: family-based model,
  Redis-backed jti tracking, reuse detection → full family revocation
- Bug found + fixed: redundant `findByEmail` call in refresh() using a field
  (`email`) that isn't in the refresh token payload — corrected to `findById`,
  added `findById` to UserRepository
- Verified end-to-end via curl: signup (201), login (200 + cookie), refresh
  (rotation succeeds), replayed stale cookie → 401 + family revoked, logout (204)

### Day 4
- restaurant-service built (routes → controller → service → repository, matching user-service)
- Schema: restaurants + menu_items, composite index (cuisine, rating), FK index on menu_items.restaurant_id
- Seed script (faker-generated, 25 restaurants / ~125 menu items, transaction-wrapped, idempotent)
- GET /restaurants (cuisine + minRating filters, pagination) and GET /restaurants/:id (+ menu) working
- Bug: CREATE TABLE IF NOT EXISTS silently skipped schema update on a stale table from an earlier
  attempt — had to DROP + re-apply migration manually. Real gotcha with raw SQL migrations vs a
  proper migration tool (Knex/Prisma) that tracks applied migrations explicitly.
- Deferred gateway routing + Consul registration to Day 5 per plan