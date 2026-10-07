# hello-hugh — Location Check-In POC

See [`location-checkin-poc-plan.md`](./location-checkin-poc-plan.md) for the full project plan.

## Structure

- `frontend/` — Vite + vanilla JS. Two pages: `index.html` (Hugh's check-in form, password-gated) and `timeline.html` (public, read-only).
- `backend/` — Node/Express API: session-based auth for Hugh, photo upload to S3-compatible storage, Postgres via `pg`.

## Setup

Secrets are managed with [fnox](https://github.com/jdx/fnox) (`fnox.toml` at the repo root) rather than plaintext `.env` files. Current secrets: `S3_ACCESS_ID`, `S3_SECRET_KEY`, `S3_ENDPOINT_URI`. Still needed: `HUGH_PASSWORD`, `SESSION_SECRET`.

### Run everything in Docker (recommended)

One image serves both the built frontend and the API (see `Dockerfile`) — `docker-compose.yml` maps fnox's secret names onto the env vars the app expects:

```sh
mise run up
```

Docker Compose always uses its own local Postgres container (`db`) — `DATABASE_URL` from fnox is ignored. When deployed on Aiven, the platform injects the real `DATABASE_URL` for `hello-hugh-pg`, so there's nothing to store.

Run the migration once against the local DB:

```sh
mise run migrate
```

(Or, without Docker: `cd backend && fnox exec -- bun run migrate`.)

### Local dev without Docker

Backend:

```sh
cd backend
bun install
fnox exec -- bun run migrate   # creates the checkins table
fnox exec -- bun run dev
```

Frontend (separate dev server, hits the backend cross-origin):

```sh
cd frontend
cp .env.example .env   # set VITE_API_BASE_URL=http://localhost:3001
bun install
bun run dev
```

HTTPS is required for geolocation and camera access on a real phone (see plan §3/§9) — `localhost` is fine in a desktop browser for wiring things up, but testing on Hugh's phone needs a real TLS URL (a tunnel like `cloudflared`/`ngrok`, or a deployed instance).

## Status

Phase 0 (scaffold) done. Aiven for PostgreSQL and the S3 bucket still need to be provisioned/configured — env files above are placeholders.
