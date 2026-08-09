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

## Week 2 — Day 3 — Nearby Restaurants (Geospatial) + Indexing Lab
**Status:** ✅ Complete

### Completed
- Seed script rewritten for volume: batched multi-row INSERTs, configurable
  via SEED_COUNT (default 2000), restaurants + menu items in ~4 round trips
  instead of one query per row
- Nearby-restaurants query: bounding-box pre-filter (sargable range
  predicate) + Haversine distance computed only within the box, LEAST/
  GREATEST-clamped acos() to avoid NaN from floating-point rounding near
  the search origin
- Composite btree index on (latitude, longitude); pg_trgm extension +
  GIN trigram index on restaurants.name (carried over from Day 2's known
  gap)
- Route ordering fix: /nearby registered before /:id to avoid Express
  matching "nearby" as a UUID param
- Full EXPLAIN ANALYZE before/after lab run against 2000 seeded rows

### Key findings (the actual point of today)
- Naive Haversine (no bounding box) forces Seq Scan regardless of any
  index — the distance calc isn't a range predicate, nothing to index on
- Bounding-box version at ~6% selectivity (123/2000 rows): index scan was
  SLOWER than seq scan (4.63ms vs 1.03ms) — a real, expected crossover
  effect at this row count/selectivity, not a bug. Documented as: indexes
  aren't free: they only win once the predicate is selective enough that
  skipping most of the table outweighs bitmap/heap lookup overhead
- Trigram search: "kitchen" (~20% selectivity, 412/2000 rows) — seq scan
  chosen, index would've been slower. "zephyr" (~0% selectivity) —
  Bitmap Index Scan on idx_restaurants_name_trgm confirmed working.
  Same underlying lesson as the lat/lng result via a different index type
- Takeaway for interviews: "does adding an index help" is the wrong
  question — the real one is "how selective is this predicate," and I
  can now back that with measured EXPLAIN ANALYZE numbers, not just theory

### Deviations
- Retyped index name as idx_restaurant_lat_lng (singular) vs migration
  file's idx_restaurants_lat_lng (plural) — functionally harmless, noting
  so file and DB don't quietly diverge going forward
- docker exec -f against a path not present in the container (initial
  attempt) — fixed by docker cp'ing the migration file into swiggy-postgres
  first; noting since Postgres container has no bind-mount into the repo,
  unlike user-service

### Known gap (still open, not closed by today)
- restaurant-service still has no test suite — no __tests__ folder, and
  package.json's "test": "jest" script references a dependency that isn't
  installed. Flagged Day 3 session start, not yet scheduled to a specific
  day.

  ## Week 2 — Day 4 — Filters + useTransition vs useDeferredValue + restaurant-service Test Suite
**Status:** ✅ Complete

### Completed
- **restaurant-service test gap closed** (carried over from Day 1–3): extracted `createApp()` factory
  (mirrors user-service's pattern), added `FakeRestaurantRepository`, 10 Supertest integration tests
  covering list/search/cuisine filters, 404 on unknown id, and — critically — a regression test locking
  in the `/nearby` route-ordering fix from Day 3 so it can't silently break again
- Backend: `pageSize` cap raised 50 → 500 in `restaurantService.listRestaurants` to support the
  Browse & Filter view's single large fetch
- Frontend: `expensiveFilterAndSort` util (deliberately expensive — 20k-iteration busy loop per
  filtered item), `FilterPanel` component (cuisine/price/rating controls), tab switcher added to
  `App.tsx` between Search and Browse & Filter views
- Built and compared three versions of the same filtering UI on 500 seeded restaurants:
  - `BrowseAllNaive` — synchronous, blocking, demonstrates the problem
  - `BrowseAllTransition` — `useTransition`, **first version had a real bug** (see below), fixed
    and reprofiled to confirm
  - `BrowseAllDeferred` — `useDeferredValue`, correct from the start
- Captured and read 5 real React DevTools Profiler exports across the session (not simulated) —
  naive on initial load, naive on cuisine change, broken transition, corrected transition

### Key findings (the actual point of today)

**On the test suite:**
- Extracting `createApp()` as a factory (same pattern as user-service) is what makes Supertest
  possible without a real server/DB — routes, controller validation, and service logic all run for
  real against a fake repository

**On useTransition — this is the big one:**
- First `BrowseAllTransition` implementation called `expensiveFilterAndSort()` **eagerly inside the
  `startTransition` callback, before calling `setState`.** Profiler data proved this: the ~1150ms
  busy-loop cost was invisible in every commit — only the (cheap) cost of rendering an
  already-computed array showed up. `startTransition` only affects scheduling of the render a state
  update triggers — it does nothing for synchronous work that already finished before that state
  update was ever called, because JS has no way to preempt a running synchronous function
- **Fix:** moved the expensive call into `useMemo`, computed during render, driven by
  `transitionFilters` (state only ever updated inside `startTransition`). Reprofiled and confirmed:
  the cost now correctly lands as self-time on `BrowseAllTransition`'s own fiber inside the
  `Normal`-priority commit
- Real interview-relevant takeaway: "I wrapped a setState in startTransition" ≠ "I made the
  expensive work interruptible." The computation has to happen *as a consequence of* the scheduled
  render, not before it

**Bonus finding, not chased today:**
- Even after the fix, "Immediate" (urgent) commits were still costing ~65-95ms on `RestaurantGrid`
  that shouldn't have needed to re-render at all (`filtered` hadn't changed in those commits).
  Root cause: neither `RestaurantGrid` nor `RestaurantCard` is wrapped in `React.memo`, so any parent
  re-render re-runs their render functions regardless of whether props actually changed. Flagged as
  a concrete, actionable optimization — deferred to Week 5 (`React.memo` is already scoped there),
  not chased further today

**Methodology caveat, worth remembering for Week 6 load-testing too:**
- Raw millisecond values dropped across the session (1728.9ms → ~100-230ms range) partly from
  smaller filtered sets (cuisine-specific vs. all 500), but likely also from V8 JIT warming up
  `expensiveFilterAndSort` across many repeated calls in the same browser tab/session. The
  *structural* findings (which fiber bears the cost, urgent vs. transition split) are solid;
  absolute-ms comparisons across separate profiling recordings in one session are not a clean
  controlled benchmark the way this morning's `EXPLAIN ANALYZE` before/after was

### Deviations
- None beyond the useTransition bug above — caught and fixed same-session via real profiler evidence,
  not silently patched or assumed correct

### Known gaps (carried forward)
- New Day 4 components (`FilterPanel`, `BrowseAllNaive/Transition/Deferred`, `expensiveFilterAndSort`)
  have no test coverage yet — explicitly deferred to avoid stacking further scope onto an already
  dense session; pick up as first task next session
- axe DevTools / Lighthouse pass on the new Browse & Filter view not yet run — same deferral
- `React.memo` on `RestaurantGrid`/`RestaurantCard` — flagged optimization, intentionally deferred
  to Week 5 per roadmap scope