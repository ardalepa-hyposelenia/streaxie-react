# Implementation validation — 13 November 2026

Validated locally with a fresh PostgreSQL cluster and database used only for these tests. The existing project database and `.env` were not changed. Temporary servers were stopped after validation.

| Check | Result |
| --- | --- |
| `bun install --frozen-lockfile` | Passed with Bun 1.4.4 and migrated `bun.lock` |
| `bun run test` | 15 tests passed across 4 files with Bun |
| `bun run build` | TypeScript check, Vite build, and offline shell generation passed with Bun |
| `bun run format:check` | Passed |
| Turnstile browser checks | 2 tests passed with a site-key build and intercepted provider script |
| Bun/Vite browser smoke test | Landing, registration navigation, and responsive layout at 320/390/1440 pixels passed in Edge |
| Full browser API flow | 3 tests passed against an isolated Go API; 5 total including Turnstile checks |
| `go test ./...` with `TEST_DATABASE_URL` | Passed, including PostgreSQL and HTTP integration tests |
| `go vet ./...` | Passed |
| `go build ./cmd/api` | Passed |

Browser coverage includes signup and timezone setup, binary and quantity check-ins, tolerated results, per-card streaks, keyboard activation, a previous-day 21:00 target with 00:30 on the evaluation date, durable pending state after offline reload, reconnect and refresh, confirmed history, archive/edit/restore, queue retention on logout, account isolation, and verification/reset form states using mocked email endpoints. Go HTTP integration tests cover actual one-use tokens and session revocation. No page JavaScript errors were reported in the main app flow. Layout checks passed at 320 and 390 pixels without horizontal overflow.

Unit coverage includes DST and rollover boundaries, scheduled timezone settings, streak reversal, queued previous-day streaks, replacement edits, account separation, retryable network failures, HTTP-successful sync rejection, interrupted pagination, and paused account queues.

Gmail SMTP is the only application delivery method. Browser tests intercept delivery requests; Go tests use seeded tokens and an in-memory callback, while SMTP tests use a TLS test server. Gmail delivery has not been tested against the real service. No race-detector run was performed. Mobile checks used browser viewport emulation; physical phones were not tested. Paid features and the separate mobile app remain outside this implementation.

Deployment checks cover private middleware header replacement, required proxy configuration, API-before-SPA rewrites, main-only deployment rules, and rejection of unsafe backend origins. Browser checks cover renewal of single-use challenge tokens after failure and retry after a provider script fails. The backend suite includes concurrent one-time initial verification claims and a PostgreSQL rate limit shared across service instances. Vercel local build is blocked by Windows symlink permissions; the remote Linux build is the deployment check.

The screenshots under `review/` show isolated test accounts and habits, not production user data.

Frontend migration uses Bun 1.4.4 as package manager and CLI runtime via `bunfig.toml`. The dependency lock was converted from the previous lockfile, and installed direct dependency versions were checked against the prior resolved versions. `bun.lock` is now the only frontend dependency lockfile. Vitest remains the unit-test runner, invoked with `bun run test`.
