# Implementation validation — 13 November 2026

Validated locally with a fresh PostgreSQL cluster and database used only for these tests. The existing project database and `.env` were not changed. Temporary servers were stopped after validation.

| Check | Result |
| --- | --- |
| `bun install --frozen-lockfile` | Passed with Bun 1.4.4 and migrated `bun.lock` |
| `bun run test` | 11 tests passed across 3 files with Bun |
| `bun run build` | TypeScript check, Vite build, and offline shell generation passed with Bun |
| `bun run format:check` | Passed |
| `bun run test:e2e --list` | All 3 browser tests discovered under Bun |
| Bun/Vite browser smoke test | Landing, registration navigation, and responsive layout at 320/390/1440 pixels passed in Edge |
| Full browser API flow | 3 tests passed after email fixture changes before Bun migration; full API browser suite not rerun for this tooling change |
| `go test ./...` with `TEST_DATABASE_URL` | Passed, including PostgreSQL and HTTP integration tests |
| `go vet ./...` | Passed |
| `go build ./cmd/api` | Passed |

Browser coverage includes signup and timezone setup, binary and quantity check-ins, tolerated results, per-card streaks, keyboard activation, a previous-day 21:00 target with 00:30 on the evaluation date, durable pending state after offline reload, reconnect and refresh, confirmed history, archive/edit/restore, queue retention on logout, account isolation, and verification/reset form states using mocked email endpoints. Go HTTP integration tests cover actual one-use tokens and session revocation. No page JavaScript errors were reported in the main app flow. Layout checks passed at 320 and 390 pixels without horizontal overflow.

Unit coverage includes DST and rollover boundaries, scheduled timezone settings, streak reversal, queued previous-day streaks, replacement edits, account separation, retryable network failures, HTTP-successful sync rejection, interrupted pagination, and paused account queues.

Gmail SMTP is the only application delivery method. Browser tests intercept delivery requests; Go tests use seeded tokens and an in-memory callback, while SMTP tests use a TLS test server. Gmail delivery itself requires configured credentials and has not been tested against the real service. No deployment, Git commit, or race-detector run was performed. Mobile checks used browser viewport emulation; physical phones were not tested. Paid features and the separate mobile app remain outside this implementation.

The screenshots under `review/` show isolated test accounts and habits, not production user data.

Frontend migration uses Bun 1.4.4 as package manager and CLI runtime via `bunfig.toml`. The dependency lock was converted from the previous lockfile, and installed direct dependency versions were checked against the prior resolved versions. `bun.lock` is now the only frontend dependency lockfile. Vitest remains the unit-test runner, invoked with `bun run test`.
