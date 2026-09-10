---
title: Location Check-In POC — Project Plan
author: Jay Miller
date: 2026-09-10
status: Planning (no code written)
---

# Location Check-In POC — Project Plan

## 1. Goal

Prove out a simple flow where a phone browser captures an approximate location and a photo, submits both as a "check-in," stores the record, and notifies a Slack channel — with a public read-only timeline anyone can view. Hugh is the only person who can create check-ins; everyone else is a viewer.

Success for the POC means: Hugh can open the site on his phone, grant location and camera permissions, submit a check-in, see it land in the database, see a Slack message appear within a few seconds, and see the check-in show up on the public timeline immediately after.

## 2. Scope

In scope: a mobile-friendly web app (not a native app), approximate geolocation capture, photo capture from the device camera, a backend API that writes check-ins to a database, a public read-only timeline page, a single authenticated account for Hugh, and a Slack webhook fired on every new check-in.

Out of scope for the POC: multi-user accounts beyond Hugh, offline support, push notifications, editing or deleting past check-ins, geofencing or location validation, image moderation, and any native app packaging. These are reasonable follow-ups once the POC proves the core loop, but building them now would slow down getting a working demo.

## 3. Architecture Overview

The app is a single-page web app (PWA-style, no native wrapper) served over HTTPS — HTTPS is required because both `navigator.geolocation` and camera access (`getUserMedia`) are blocked by browsers on insecure origins. Hugh's browser handles two device APIs directly: the Geolocation API for an approximate lat/long (with a note below on accuracy), and either `getUserMedia` with a canvas capture, or a plain `<input type="file" accept="image/*" capture="environment">` for the simplest possible camera trigger on mobile.

On submit, the client sends the coordinates and the photo to a small backend API. That API uploads the photo to an existing S3-compatible bucket, writes a check-in row to Aiven for PostgreSQL with a reference to that object (see section 5), and then fires a Slack Incoming Webhook with a short message and a link to (or thumbnail of) the photo. The same API exposes a read-only endpoint that powers the public timeline page, which needs no login.

Suggested stack for speed: a lightweight frontend (Vite + vanilla JS, or a minimal React setup if Hugh wants component structure) talking to a small Node.js/Express API. Nothing here is exotic — the goal is to spend the build time on the geolocation/camera/webhook plumbing, not on framework choices.

## 4. Data Model

A single table covers the POC. `photo_key` holds the object key/path in the S3 bucket; the client (or a signed URL) resolves that to the actual image when rendering the timeline.

| Column | Type | Notes |
|---|---|---|
| id | uuid | primary key |
| created_at | timestamptz | server-assigned |
| lat | double precision | from Geolocation API |
| lng | double precision | from Geolocation API |
| accuracy_m | double precision | accuracy radius reported by the browser |
| photo_key | text | object key in the S3 bucket, e.g. `checkins/{id}.jpg` |
| created_by | text | will just be `"hugh"` for the POC |

## 5. Photo Storage

Photos go to an existing S3-compatible bucket rather than into Postgres. Aiven's own product line (PostgreSQL, Kafka, OpenSearch, ClickHouse, Valkey, and so on) doesn't include an object storage service, but since there are already S3 endpoints available to use, that's the natural place for images: Postgres stays small and only holds the object key, and the bucket handles the actual bytes.

For the POC, the backend can either stream the upload through itself (client → API → S3) or have the API mint a short-lived pre-signed PUT URL and let the client upload directly to S3, then just tell the API the resulting key. The pre-signed approach is a bit more setup but keeps large image payloads off the API server entirely — worth it if Hugh will be testing with full-resolution phone photos rather than downsized ones. Either way, the timeline reads images back via a pre-signed GET URL (or a public-read bucket policy, if the photos aren't sensitive) rather than proxying bytes through the API.

Credentials for the bucket (access key/secret or an IAM role) live in the backend's environment only — never in client-side code.

## 6. Auth Model

Only Hugh needs to authenticate, and only to hit the check-in submission endpoint — everyone else gets the timeline with no login at all. The simplest version of this for a POC is a single shared secret (a password Hugh enters once per session, checked server-side, setting a signed session cookie) rather than building out a full user/account system for a single account. A magic-link email would also work if a password feels like the wrong shape, but it's more moving parts for one user. Either way, the read-only timeline route stays completely open — no session check on that path at all.

## 7. Slack Integration

A Slack Incoming Webhook URL is configured once in the backend's environment. On every successful check-in write, the API posts a message with the timestamp, the approximate coordinates (or a reverse-geocoded place name if that's wanted later), and either a thumbnail image or a link back to the timeline entry. Slack webhooks are fire-and-forget from the API's perspective — if the Slack call fails, the check-in should still be considered saved; log the failure rather than rolling back the check-in.

## 8. Build Phases

**Phase 0 — Setup.** Provision the Aiven for PostgreSQL service, confirm the S3 endpoint/bucket and credentials to use, create the Slack Incoming Webhook in the target channel, scaffold the frontend and backend repos.

**Phase 1 — Core check-in flow.** Geolocation capture, photo capture, submit-to-API, write-to-database. This phase alone proves the hardest technical risk (mobile browser permissions for camera and location).

**Phase 2 — Slack notification.** Fire the webhook on a successful check-in write.

**Phase 3 — Public timeline.** Read-only endpoint and page listing check-ins, newest first, with the photo and approximate location shown.

**Phase 4 — Auth for Hugh.** Gate the submit endpoint behind Hugh's login; confirm the timeline stays open to everyone else.

**Phase 5 — Polish (stretch, optional).** Compress images client-side before upload, handle denied permissions gracefully, add a loading/success state on submit.

## 9. Risks & Open Questions

Browser permission prompts for camera and location can be denied or silently degraded (e.g., a laptop browser with no GPS falling back to coarse IP-based location) — the app needs a visible fallback state rather than failing silently. "Approximate" location from `navigator.geolocation` on mobile is usually accurate to tens of meters outdoors but can be far looser indoors or on desktop, which is worth confirming is acceptable for the intended use before treating the coordinates as reliable. HTTPS is mandatory for both APIs, so even the POC needs a real TLS-terminated URL (not just `localhost` on the phone) to test camera/location on an actual device. Finally, worth deciding early whether Slack should get the raw coordinates or a human-readable place name, since that affects whether reverse geocoding needs to be part of Phase 2 or can wait.

## 10. Explicitly Out of Scope (for now)

No native app or app-store packaging, no accounts beyond Hugh, no editing/deleting check-ins, no geofencing/validation of location, no image moderation, no offline queueing of check-ins made without signal.
