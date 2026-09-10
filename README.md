# hello-hugh — Location Check-In POC

See [`location-checkin-poc-plan.md`](./location-checkin-poc-plan.md) for the full project plan.

## Structure

- `frontend/` — Vite + vanilla JS. Two pages: `index.html` (Hugh's check-in form, password-gated) and `timeline.html` (public, read-only).
- `backend/` — Node/Express API: session-based auth for Hugh, photo upload to S3-compatible storage, Postgres via `pg`, Slack Incoming Webhook notification.

## Setup

### Backend

```sh
cd backend
cp .env.example .env   # fill in DATABASE_URL, S3_*, SLACK_WEBHOOK_URL, HUGH_PASSWORD, SESSION_SECRET
npm install
npm run migrate        # creates the checkins table
npm run dev
```

### Frontend

```sh
cd frontend
cp .env.example .env   # point VITE_API_BASE_URL at the backend
npm install
npm run dev
```

HTTPS is required for geolocation and camera access on a real phone (see plan §3/§9) — `localhost` is fine in a desktop browser for wiring things up, but testing on Hugh's phone needs a real TLS URL (a tunnel like `cloudflared`/`ngrok`, or a deployed instance).

## Status

Phase 0 (scaffold) done. Aiven for PostgreSQL, the S3 bucket, and the Slack webhook still need to be provisioned/configured — env files above are placeholders.
