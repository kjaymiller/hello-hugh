# hello-hugh — Location Check-In POC

See [`location-checkin-poc-plan.md`](./location-checkin-poc-plan.md) for the full project plan.

## Structure

- `frontend/` — Vite + vanilla JS. Two pages: `index.html` (Hugh's check-in form, password-gated) and `timeline.html` (public, read-only).
- `backend/` — Node/Express API: session-based auth for Hugh, photo upload to S3-compatible storage, Postgres via `pg`, Slack Incoming Webhook notification.

## Setup

Secrets are managed with [fnox](https://github.com/jdx/fnox) (`fnox.toml` at the repo root) rather than plaintext `.env` files. Current secrets: `S3_ACCESS_ID`, `S3_SECRET_KEY`, `S3_ENDPOINT_URI`. Still needed: `DATABASE_URL` (from the Aiven console — the Aiven MCP redacts it), `SLACK_WEBHOOK_URL`, `HUGH_PASSWORD`, `SESSION_SECRET`.

### Run everything in Docker (recommended)

One image serves both the built frontend and the API (see `Dockerfile`) — `docker-compose.yml` maps fnox's secret names onto the env vars the app expects:

```sh
mise run up
```

Then run the migration once against the same DB:

```sh
mise run migrate
```

(Or, without Docker: `cd backend && fnox exec -- npm run migrate`.)

### Local dev without Docker

Backend:

```sh
cd backend
npm install
fnox exec -- npm run migrate   # creates the checkins table
fnox exec -- npm run dev
```

Frontend (separate dev server, hits the backend cross-origin):

```sh
cd frontend
cp .env.example .env   # set VITE_API_BASE_URL=http://localhost:3001
npm install
npm run dev
```

HTTPS is required for geolocation and camera access on a real phone (see plan §3/§9) — `localhost` is fine in a desktop browser for wiring things up, but testing on Hugh's phone needs a real TLS URL (a tunnel like `cloudflared`/`ngrok`, or a deployed instance).

## Status

Phase 0 (scaffold) done. Aiven for PostgreSQL, the S3 bucket, and the Slack webhook still need to be provisioned/configured — env files above are placeholders.
