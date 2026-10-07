import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import cookieSession from "cookie-session";
import { router as checkinsRouter } from "./routes/checkins.js";
import { router as locationsRouter } from "./routes/locations.js";
import { router as adminRouter } from "./routes/admin.js";
import { login, logout, sessionStatus } from "./middleware/auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// The frontend's Vite build output, copied alongside the backend in the
// container image (see Dockerfile) so one process serves both.
const FRONTEND_DIST = path.join(__dirname, "..", "public");

const app = express();

// Required for req.protocol / req.secure to reflect X-Forwarded-Proto when
// this runs behind a TLS-terminating proxy (Aiven's Application runtime,
// or any typical PaaS/load balancer) — see the cookie `secure` note below.
app.set("trust proxy", 1);

const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

// Same-origin requests (the normal case, now that this server serves the
// built frontend itself) never hit CORS at all — this only governs *other*
// origins. Default to allowing none, rather than wildcarding, since
// /api/login and /api/checkins carry a session cookie; pass explicit
// origins via CORS_ORIGIN for cross-origin dev setups (e.g. Vite on :5173).
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(express.json());
app.use(
  cookieSession({
    name: "hh_session",
    secret: process.env.SESSION_SECRET,
    maxAge: 24 * 60 * 60 * 1000, // 1 day
    sameSite: "lax",
    // Deliberately omitted: leaving `secure` unset lets the underlying
    // `cookies` package auto-detect per request from req.protocol (which
    // `trust proxy` above makes proxy-aware). Hardcoding `secure: true` from
    // NODE_ENV === "production" broke login entirely — the `cookies`
    // package throws when secure is forced true on a request that isn't
    // actually HTTPS, and cookie-session silently swallows that error, so
    // no Set-Cookie header was ever sent and every request after login
    // came back "Not authenticated".
  })
);

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.post("/api/login", login);
app.post("/api/logout", logout);
app.get("/api/session", sessionStatus);

app.use("/api/checkins", checkinsRouter);
app.use("/api/locations", locationsRouter);
app.use("/api/admin", adminRouter);

// Serve the built frontend (static files only — all dynamic behavior goes
// through the /api routes above via fetch calls from the browser).
app.use(express.static(FRONTEND_DIST));
app.get("/timeline.html", (req, res) =>
  res.sendFile(path.join(FRONTEND_DIST, "timeline.html"))
);
app.get("/map.html", (req, res) =>
  res.sendFile(path.join(FRONTEND_DIST, "map.html"))
);
app.get("/backdate.html", (req, res) =>
  res.sendFile(path.join(FRONTEND_DIST, "backdate.html"))
);
app.get("/", (req, res) =>
  res.sendFile(path.join(FRONTEND_DIST, "index.html"))
);

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`hello-hugh backend listening on :${port}`);
});
