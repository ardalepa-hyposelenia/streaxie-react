# Streaxie web

React + TypeScript + Vite, with the existing Go API. English UI, cream and terracotta, compact cards, and a current streak on every card. Insights and Settings load separately.

## Local development

1. Configure PostgreSQL and `JWT_SECRET` using `../backend/.env.example`. Keep existing `.env` values; add the web settings below. Apply migrations with `go run ./cmd/migrate` from `backend`.
2. Set `WEB_ORIGIN=http://localhost:5173`, `GMAIL_USER`, and `GMAIL_APP_PASSWORD` in the backend environment. Gmail credentials are required. Start the API with `go run ./cmd/api` from `backend`.
3. In this directory run `bun install --frozen-lockfile`, then `bun run dev --port 5173 --strictPort`. Open `http://localhost:5173`. Vite proxies `/api` to `127.0.0.1:8080`.

Bun 1.4.4+ is required; the package manager is pinned to 1.4.4. `bunfig.toml` selects Bun as the runtime for scripts and CLI tools. Ports 8080 and 5173 are defaults. The frontend uses the same origin for API calls and cookies; do not point browser requests directly at a different API origin.

`bun.lock` is the frontend dependency lockfile. Use `bun add` / `bun add -d` to change dependencies, and `bun install --frozen-lockfile` for reproducible installs. Keep the existing Vite, React, TypeScript and Vitest toolchain; the migration changes the package manager and runtime.

## Email delivery

Gmail SMTP is the only delivery method. Follow [Gmail SMTP setup](https://github.com/ardalepa-hyposelenia/streaxie-go/blob/main/EMAIL.md): set `GMAIL_USER` and `GMAIL_APP_PASSWORD` in the backend's ignored `.env`, then restart the API. No credentials belong in the frontend. `WEB_ORIGIN` must match the site users open.

Verification and password recovery send links through Gmail. A resend invalidates the previous link for that purpose. Verification links expire after 24 hours; reset links after one hour. Both are single use.

New accounts can write for seven days before verification. After that, the API permits reads and sync pulls, while refusing check-ins, settings and habit changes. Resetting a password revokes all existing sessions.

The API requires valid Gmail configuration at startup. Configure and test your sending account before public signup is launched.

## Production build and offline testing

For the two-project Vercel deployment, follow the [production guide](https://github.com/ardalepa-hyposelenia/streaxie-go/blob/main/docs/DEPLOYMENT.md). Configure `BACKEND_ORIGIN` and private `PROXY_SHARED_SECRET` for middleware, and public `VITE_TURNSTILE_SITE_KEY` for browser challenges. See `.env.example`. Vercel builds require the site key; never prefix private secrets with `VITE_`. Local development can omit Turnstile keys.

Run `bun run build`. From `backend`, set `WEB_DIST=../frontend/dist`, set `WEB_ORIGIN` to the actual site origin, then run the API. In production set `APP_ENV=production` and use an HTTPS origin; refresh cookies are Secure. Terminate HTTPS at the deployment's reverse proxy.

The production build includes a service worker that caches only the public app shell and assets. Account data is stored separately in IndexedDB. API responses and email links are not cached by the service worker. Offline navigation works after the first successful online visit and service-worker installation. The Vite development server intentionally does not install the service worker.

The browser keeps access tokens in memory and refresh tokens in HttpOnly, SameSite Strict cookies. Refresh and queue operations are serialized across tabs with Web Locks. IndexedDB and a secure browser context (HTTPS or localhost) are required.

## Data and interactions

- Click a binary card to check/uncheck immediately. Click a quantity/time card to open Save/Cancel inputs. Enter/Space work on the card; input interaction does not activate it.
- Confirm device timezone and rollover before the first habit. Later timezone changes begin at the next existing day boundary. Later target changes begin next logical day; historical rules remain intact.
- Offline supports existing-habit check-ins and cached reads. Habit creation/edit/archive and account/settings operations require connectivity.
- Each check-in is persisted before showing pending. Current-day items use Direct REST; items crossing rollover use sync with their original timestamp and logical date. Only acknowledged items leave the queue. HTTP 200 with a rejected sync item remains a visible error.
- Queues are isolated by account and survive reload. Logout warns about pending items, retains them and pauses sending until the same account signs in. Signout itself requires connectivity to revoke the server session.
- Newer edits replace older queued edits for the same habit/day. A response for the older edit cannot delete its replacement. Temporary failures retry on reconnection or while the open page polls every 30 seconds. The closed browser does not send background updates.
- Confirmed streaks come from the API; optimistic streaks use cached logs and pending edits and are marked pending. Insights shows confirmed history. Habits keep evaluation-time order when completed.
- Settings contains habit editing and Archive. Deletes require confirmation. Stale metadata versions are rejected by the API; close the form, review the refreshed habit, and reopen before retrying.
- No billing or premium limits are implemented.

## Validation

`bun run test` covers time boundaries, overnight targets, streak reversals, account isolation, queue replacement, rollover sync, partial rejection and interrupted pagination. Use `bun run test` to invoke the existing Vitest suite; `bun test` invokes Bun's separate built-in runner. `bun run build` includes TypeScript checking; `bun run format:check` checks formatting.

`bun run test:e2e` uses installed Edge headless against a running **isolated test backend**, default `http://127.0.0.1:18080` (override `WEB_TEST_URL`). It creates test accounts and habits: do not point it at a live user database. Serve `dist` from that API to test service-worker offline reload. Browser fixtures intercept delivery requests and simulate email-form responses, so no external email is sent. Go integration tests cover actual token consumption and session revocation using test tokens; they use `TEST_DATABASE_URL` and create/remove their own random schemas. SMTP transport tests use a TLS test server. None of these test doubles are available as an application delivery mode.

This is the independent **streaxie-react** repository. In the local workspace it is checked out as `frontend/`, beside the **streaxie-go** checkout at `backend/`. See [frontend documentation](docs/README.md) for design decisions and the prototype. Shared product rules and backend audit documents are maintained in streaxie-go/docs.
