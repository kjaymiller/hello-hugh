# hello-hugh — Location Check-In POC

See [`location-checkin-poc-plan.md`](./location-checkin-poc-plan.md) for the full project plan.

## Accounts

Check-ins belong to an account. Accounts authenticate with an API key (`Authorization: Bearer <key>` or `X-API-Key: <key>`); Hugh's browser login still works and acts as the `hugh` account. There's no UI — accounts are managed through `/api/admin/*`, guarded by the `ADMIN_API_KEY` env var (unset = admin API disabled, returns 503). Store it with `fnox set ADMIN_API_KEY` and set it on the deployed app.

```sh
H="Authorization: Bearer $ADMIN_API_KEY"
curl -H "$H" $URL/api/admin/accounts                                   # list
curl -H "$H" -H 'Content-Type: application/json' \
  -d '{"slug":"alice","name":"Alice"}' $URL/api/admin/accounts         # create -> returns api_key ONCE
curl -X POST -H "$H" $URL/api/admin/accounts/alice/rotate-key          # new key, old one stops working
curl -X DELETE -H "$H" $URL/api/admin/accounts/alice                   # revoke (check-ins are kept)
```

Keys are stored only as SHA-256 hashes, so a lost key can't be recovered — rotate it. Rotating also reactivates a revoked account, and is how `hugh` gets his first API key. Accounts submit check-ins with `POST /api/checkins` (multipart: `photo`, `lat`, `lng`, optional `taken_at`, `nickname`), and saved places are private to each account. The public timeline and map show everyone's check-ins; filter with `?account=<slug>`.

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
