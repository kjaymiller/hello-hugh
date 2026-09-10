import { Router } from "express";
import multer from "multer";
import { v4 as uuid } from "uuid";
import { query } from "../db.js";
import { uploadCheckinPhoto, resolvePhotoUrl } from "../s3.js";
import { notifySlack } from "../slack.js";
import { reverseGeocodeCity } from "../geocode.js";
import { requireHugh } from "../middleware/auth.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB, generous for a phone photo
});

export const router = Router();

// Public, read-only timeline feed — newest first. No auth check on this path.
router.get("/", async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, created_at, lat, lng, accuracy_m, photo_key, created_by, city, nickname
       FROM checkins ORDER BY created_at DESC LIMIT 100`
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

// Hugh-only submission endpoint.
router.post("/", requireHugh, upload.single("photo"), async (req, res) => {
  try {
    const lat = Number(req.body.lat);
    const lng = Number(req.body.lng);
    const accuracyM = req.body.accuracy_m ? Number(req.body.accuracy_m) : null;
    // Optional — set when Hugh picked a nearby nicknamed location (or typed
    // one) on the check-in screen. Takes priority over the geocoded city
    // wherever a place name is shown.
    const nickname = req.body.nickname ? String(req.body.nickname).trim() : null;

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
      `INSERT INTO checkins (id, lat, lng, accuracy_m, photo_key, created_by, city, nickname)
       VALUES ($1, $2, $3, $4, $5, 'hugh', $6, $7)
       RETURNING id, created_at, lat, lng, accuracy_m, photo_key, created_by, city, nickname`,
      [id, lat, lng, accuracyM, photoKey, city, nickname]
    );
    const checkin = rows[0];

    // Fire-and-forget: a Slack failure must not fail the check-in.
    notifySlack(checkin);

    res.status(201).json(checkin);
  } catch (err) {
    console.error("Failed to create check-in:", err);
    res.status(500).json({ error: "Failed to save check-in" });
  }
});
