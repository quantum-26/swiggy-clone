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

### Day 5
- **Pre-existing bug fixed:** user-service and api-gateway both had their entry
  file at root `index.js`, but `package.json` scripts (`dev`/`start`) and the
  Dockerfile's production `CMD` pointed at `src/index.js` — `npm run dev`
  would have failed inside the container. Moved both to `src/index.js` to
  match restaurant-service's existing convention.
- **JWT helper extraction:** pulled `jwt.sign`/`jwt.verify` calls out of
  `AuthService`'s private `#issueTokenPair` method into standalone
  `src/utils/jwtHelper.js` (`signAccessToken`, `signRefreshToken`,
  `verifyAccessToken`, `verifyRefreshToken`). This is what made unit-testing
  the JWT logic in isolation possible — no DB/Redis/Express needed.
- **Testability refactor:** split user-service's `index.js` into
  `src/app.js` (pure `createApp()` factory, never calls `.listen()`) and
  `src/index.js` (thin bootstrap — wires real Postgres/Redis, calls
  `createApp()`, starts the server). This boundary is what let Supertest
  run against the real app without a real database.
- **Testing:**
  - `__tests__/jwtHelper.test.js` — 6 unit tests (sign/verify round-trip,
    wrong-secret rejection, payload shape, expired-token rejection,
    access/refresh non-interchangeability)
  - `__tests__/auth.integration.test.js` — 13 Supertest integration tests
    against the real `AuthService`/`AuthController`, using
    `FakeUserRepository`/`FakeRefreshTokenRepository` (in-memory Maps) only
    at the persistence boundary. Covers signup/login/refresh/logout
    including the theft-detection path (rotate → replay old token → both
    old and newly-rotated tokens rejected once the family is revoked).
  - **17/17 tests passing**, actually run locally, not just written.
  - Known gap, deliberately deferred: these tests never touch real
    Postgres/Redis, so a broken SQL query or bad Redis key logic in the
    real repositories would NOT be caught today. Real-repository contract
    tests (same behavioral spec run against both fakes and real
    infra) are planned for Week 6 per `Project_Master_Plan.md`'s testing
    timeline — not an oversight, a scheduling decision.
- **Consul service discovery (first real use):**
  - `user-service` and `restaurant-service` each register themselves with
    Consul on startup (`src/consul/registerService.js` — plain `fetch`
    calls against Consul's HTTP agent API, no SDK) and deregister on
    `SIGTERM`.
  - `api-gateway` polls Consul every 5s for both service names into an
    in-memory cache (`src/config/serviceRegistry.js`), then
    `http-proxy-middleware`'s `router` reads that cache synchronously per
    request — Consul latency never touches request latency.
  - `/auth` and `/restaurants` now proxy through the gateway to
    dynamically-resolved instances instead of hardcoded URLs.
  - `docker-compose.yml`: added a single-node dev-mode `consul` service,
    `CONSUL_URL`/`CONSUL_SERVICE_ADDRESS` env vars on all three services.
- **Bugs fixed along the way:**
  - restaurant-service: `/healthy/ready` → `/health/ready` typo (was
    inconsistent with the other two services)
  - restaurant-service: startup log said `"user-service listening..."`
    (copy-paste leftover) → corrected
  - `NODE_ENV: developement` → `development` typo in docker-compose.yml
  - Removed `services/api-gateway/src/config/services.js` — dead code now
    that Consul handles resolution (had a stray `:400` port typo in its
    fallback default, masked by the env var override, moot now either way)
- **Windows-specific issue debugged:** restaurant-service registered with
  Consul successfully on startup, then went silent — Consul's registry
  eventually showed zero instances. Root cause: nodemon's native file
  watcher misfiring over the Docker Desktop Windows bind-mount, causing a
  crash/restart loop that made the Consul health check fail continuously
  until `DeregisterCriticalServiceAfter` (1m) removed the registration.
  Fixed by switching restaurant-service's `dev` script to
  `nodemon --legacy-watch` (polling-based watching instead of native OS
  file events).
- **End-to-end verification performed** (not just "it compiles"):
  - `docker compose up --build` → all services register with Consul,
    confirmed via `http://localhost:8500/ui` and
    `/v1/health/service/<name>?passing=true`
  - `GET /restaurants` through the gateway (port 4000) returns seeded data
    — proves gateway → Consul → restaurant-service routing, not just
    restaurant-service standalone
  - Full signup → login → refresh → replay-old-token-rejected →
    logout-revokes-family flow verified via curl through the gateway
  - Graceful shutdown verified: `docker compose stop user-service` logs
    `SIGTERM received...` → `[consul] deregistered...`, and Consul's
    registry immediately reflects the removal

**End-of-week checklist (Week 1) — status:**
- [x] JWT access+refresh flow fully working, tokens in httpOnly cookies
- [x] Consul registering 2 services, gateway resolving dynamically
- [x] Jest + Supertest passing for user-service
- [ ] Closures + call stack lab — carried into Weekend session