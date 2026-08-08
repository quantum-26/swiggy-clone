## Week 1 — Infra + Auth Foundation
**Status:** ✅ Complete

### Goal (per plan)
Docker stack running, `api-gateway` + `user-service` live with full JWT auth,
`restaurant-service` stub reachable through the gateway.

### Completed

**Day 1 — Infra scaffold**
- Docker Compose skeleton: Postgres + Redis with healthchecks
- Repo structure for all 6 services stubbed out
- Multi-stage Dockerfile pattern established (dev/dependencies/production targets)

**Day 2 — user-service auth foundation**
- `users` table schema + migration
- Signup/login endpoints
- bcrypt password hashing (cost factor 10)
- JWT sign/verify via `jsonwebtoken` — access token (15m) + refresh token (7d)
- Layered architecture: routes → controllers → services → repositories

**Day 3 — api-gateway**
- Express reverse-proxy routing to `user-service` via `http-proxy-middleware`
- JWT verification middleware at the edge (access secret only — refresh secret
  never exposed to gateway, explicit security boundary)
- Centralized error-handling middleware (4-arg signature)
- httpOnly + Secure + SameSite cookie handling for refresh token
- **[B] Manual exercise:** JWT refresh-token rotation written from scratch
  (no library shortcuts) — family-based model, Redis-backed `jti` tracking,
  full family revocation on reuse detection (theft signal)
- Bug found + fixed: redundant `findByEmail` call in refresh flow (JWT payload
  carries no email) → corrected to `findById`, added `RefreshTokenRepository`

**Day 4 — restaurant-service stub**
- Basic Express app, `/restaurants` GET endpoint
- Postgres table + seed script (20–30 fake restaurants + menu items)

**Day 5 — Testing + service discovery**
- `jwtHelper.js` extracted, 6 unit tests
- `app.js`/`index.js` split for testability
- 13 Supertest integration tests (fake repositories) — 17/17 passing
- Consul wired for `user-service` + `restaurant-service` registration
- Gateway resolves both services dynamically (polling cache + round-robin,
  no per-request Consul calls)
- Bugs found + fixed: entry-point mismatch (`package.json` pointed at
  `src/index.js`, file was at root) in user-service + api-gateway;
  restaurant-service typos (`/healthy/ready` → `/health/ready`, `NODE_ENV`,
  misleading log line)

**Weekend — JS Lab Session #1 [B] + buffer**
- Closures: counter factory (private `count` per closure instance) +
  memoize factory (`Map`-backed cache, discussed prototype-pollution
  risk of plain objects vs `Map`)
- Call stack: recursive function with no base case, observed
  `RangeError: Maximum call stack size exceeded` in terminal + Chrome
  DevTools (`--inspect-brk`), compared overflow depth with a
  bigger-stack-frame variant to demonstrate stack-as-memory-budget,
  not fixed frame count

### Deviations from plan
- Windows + Docker Desktop: nodemon's native file watcher misfired over the
  bind-mounted volume, causing restaurant-service to crash-loop and
  deregister from Consul. Fixed with `nodemon --legacy-watch` in
  restaurant-service's dev script. **Flag:** may need the same fix in other
  services once their dev scripts are live.
- Contract tests for real `UserRepository`/`RefreshTokenRepository` (against
  real Postgres/Redis, not fakes) deliberately deferred to Week 6 per the
  plan's own testing timeline. Known gap, not a silent skip.
- Week 1's plan table lists Days 1–5 individually, then one combined
  "Weekend" slot (JS Lab + catch-up buffer) — not separate Day 6/Day 7
  content. Noting this only so weekly day-numbering doesn't drift from the
  plan's own structure going forward.

### End-of-week checklist (from plan)
- [x] JWT access+refresh flow fully working, tokens in httpOnly cookies
- [x] Consul registering 2 services, gateway resolving dynamically
- [x] Jest + Supertest passing for user-service (17/17)
- [x] Closures + call stack lab done

---

## Week 2 — Day 2 — Restaurant Search (Debounced) + `useDebounce`
**Status:** ✅ Complete

### Completed
- restaurant-service: added `name ILIKE` search, composable with existing
  `cuisine`/`minRating` filters
- Fixed `pasgeSize` typo (controller + service) → `pageSize`
- Renamed response envelope `restaurant` → `restaurants` (was singular, is
  an array)
- Bug found + fixed: controller never forwarded `search` to the service —
  root cause of search always returning the same list
- Bug found + fixed: `ILIKE` pattern missing trailing `%` (only matched
  names ending in the term, not containing it)
- Fixed Day 1 gap: `vite.config.ts` proxy needed a `/api` rewrite — gateway
  has no `/api` prefix, today's fetch would have 404'd
- Built `useDebounce<T>` custom hook
- `ApiRestaurant`/`Restaurant` type split + `mapToRestaurant()` mapper
  (handles pg's `NUMERIC`-as-string coercion on `rating`)
- `restaurantApi.ts` fetch wrapper — no `AbortController` yet, on purpose
  (Week 4 race-condition exercise)
- `SearchBar` component + `App.tsx` rewired: instant input →
  debounced(400ms) → fetch, with loading/error status states

### Deviations
- None beyond the bugs above — caught and fixed same-session

### Known gap (scheduled, not skipped)
- No index on `name` yet for `ILIKE` search — correct at current seed size
  (~25 rows). Folding a `pg_trgm` GIN index into Day 3's existing
  indexing/`EXPLAIN ANALYZE` lab, since a plain B-tree can't accelerate
  `ILIKE '%term%'`

### Note
- Corrected myself mid-session: called `mapToRestaurant()` "Adapter
  pattern" — more precisely a mapper/anti-corruption layer, not Adapter
  (Adapter needs multiple incompatible interfaces unified behind one;
  real example is Week 5's notification providers)

---