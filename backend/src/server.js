import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import cookieSession from "cookie-session";
import { router as checkinsRouter } from "./routes/checkins.js";
import { login, logout, sessionStatus } from "./middleware/auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// The frontend's Vite build output, copied alongside the backend in the
// container image (see Dockerfile) so one process serves both.
const FRONTEND_DIST = path.join(__dirname, "..", "public");

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : true,
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
    secure: process.env.NODE_ENV === "production",
  })
);

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.post("/api/login", login);
app.post("/api/logout", logout);
app.get("/api/session", sessionStatus);

app.use("/api/checkins", checkinsRouter);

// Serve the built frontend (static files only — all dynamic behavior goes
// through the /api routes above via fetch calls from the browser).
app.use(express.static(FRONTEND_DIST));
app.get("/timeline.html", (req, res) =>
  res.sendFile(path.join(FRONTEND_DIST, "timeline.html"))
);
app.get("/", (req, res) =>
  res.sendFile(path.join(FRONTEND_DIST, "index.html"))
);

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`hello-hugh backend listening on :${port}`);
});
