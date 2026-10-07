import { Router } from "express";
import multer from "multer";
import { v4 as uuid } from "uuid";
import { query } from "../db.js";
import { uploadCheckinPhoto, resolvePhotoUrl } from "../s3.js";
import { reverseGeocodeCity } from "../geocode.js";
import { requireAccount } from "../middleware/auth.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB, generous for a phone photo
});

export const router = Router();

// Public, read-only timeline feed — newest first. No auth check on this path.
// Optional ?account=<slug> narrows it to one account.
router.get("/", async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT c.id, c.created_at, c.lat, c.lng, c.accuracy_m, c.photo_key,
              c.created_by, c.city, c.nickname, a.slug AS account, a.name AS account_name
       FROM checkins c JOIN accounts a ON a.id = c.account_id
       WHERE ($1::text IS NULL OR a.slug = $1)
       ORDER BY c.created_at DESC LIMIT 100`,
      [req.query.account || null]
    );
    const withUrls = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        photo_url: await resolvePhotoUrl(row.photo_key),
      }))
    );
    res.json(withUrls);
  } catch (err) {
    console.error("Failed to list check-ins:", err);
    res.status(500).json({ error: "Failed to load check-ins" });
  }
});

// Public, read-only feed of every check-in's location for the map page —
// slimmer than the timeline feed and not capped at 100, since the map is
// meant to show everywhere Hugh has been.
router.get("/map", async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT c.id, c.created_at, c.lat, c.lng, c.photo_key, c.city, c.nickname,
              a.slug AS account, a.name AS account_name
       FROM checkins c JOIN accounts a ON a.id = c.account_id
       WHERE ($1::text IS NULL OR a.slug = $1)
       ORDER BY c.created_at ASC`,
      [req.query.account || null]
    );
    const withUrls = await Promise.all(
      rows.map(async ({ photo_key, ...row }) => ({
        ...row,
        photo_url: await resolvePhotoUrl(photo_key),
      }))
    );
    res.json(withUrls);
  } catch (err) {
    console.error("Failed to list check-in locations:", err);
    res.status(500).json({ error: "Failed to load check-in locations" });
  }
});

// Authenticated submission endpoint — the check-in belongs to the calling account.
router.post("/", requireAccount, upload.single("photo"), async (req, res) => {
  try {
    const lat = Number(req.body.lat);
    const lng = Number(req.body.lng);
    const accuracyM = req.body.accuracy_m ? Number(req.body.accuracy_m) : null;
    // Optional — set when Hugh picked a nearby nicknamed location (or typed
    // one) on the check-in screen. Takes priority over the geocoded city
    // wherever a place name is shown.
    const nickname = req.body.nickname ? String(req.body.nickname).trim() : null;

    // Optional — set by the backdate form to record a check-in that happened
    // earlier. Absent = a normal live check-in stamped with now().
    let takenAt = null;
    if (req.body.taken_at) {
      takenAt = new Date(req.body.taken_at);
      if (Number.isNaN(takenAt.getTime())) {
        return res.status(400).json({ error: "Invalid taken_at date" });
      }
      // 1 minute of slack for clock skew between phone and server.
      if (takenAt.getTime() > Date.now() + 60 * 1000) {
        return res.status(400).json({ error: "taken_at can't be in the future" });
      }
    }

    if (!req.file) {
      return res.status(400).json({ error: "Missing photo" });
    }
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ error: "Missing or invalid lat/lng" });
    }

    const id = uuid();
    const photoKey = await uploadCheckinPhoto(
      id,
      req.file.buffer,
      req.file.mimetype
    );
    // Best-effort — a geocoding failure must not block saving the check-in.
    const city = await reverseGeocodeCity(lat, lng);

    const { rows } = await query(
      `INSERT INTO checkins (id, lat, lng, accuracy_m, photo_key, created_by, city, nickname, created_at, account_id)
       VALUES ($1, $2, $3, $4, $5, $9, $6, $7, COALESCE($8::timestamptz, now()), $10)
       RETURNING id, created_at, lat, lng, accuracy_m, photo_key, created_by, city, nickname`,
      [id, lat, lng, accuracyM, photoKey, city, nickname, takenAt, req.account.slug, req.account.id]
    );
    const checkin = rows[0];

    res.status(201).json(checkin);
  } catch (err) {
    console.error("Failed to create check-in:", err);
    res.status(500).json({ error: "Failed to save check-in" });
  }
});
