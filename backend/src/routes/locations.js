import { Router } from "express";
import { v4 as uuid } from "uuid";
import { query } from "../db.js";
import { haversineMeters } from "../geo.js";
import { requireAccount } from "../middleware/auth.js";

export const router = Router();

// Nicknamed locations are an account's own frequented spots — not exposed on
// the public timeline, so every route here requires an account and only ever
// sees that account's places.
router.use(requireAccount);

router.get("/", async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, name, lat, lng, radius_m, created_at FROM locations
       WHERE account_id = $1 ORDER BY name ASC`,
      [req.account.id]
    );
    res.json(rows);
  } catch (err) {
    console.error("Failed to list locations:", err);
    res.status(500).json({ error: "Failed to load locations" });
  }
});

// Locations within their own radius_m of (lat, lng), nearest first.
router.get("/nearby", async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ error: "Missing or invalid lat/lng" });
    }

    const { rows } = await query(
      `SELECT id, name, lat, lng, radius_m FROM locations WHERE account_id = $1`,
      [req.account.id]
    );
    const nearby = rows
      .map((loc) => ({
        ...loc,
        distance_m: haversineMeters(lat, lng, loc.lat, loc.lng),
      }))
      .filter((loc) => loc.distance_m <= loc.radius_m)
      .sort((a, b) => a.distance_m - b.distance_m);

    res.json(nearby);
  } catch (err) {
    console.error("Failed to find nearby locations:", err);
    res.status(500).json({ error: "Failed to find nearby locations" });
  }
});

router.post("/", async (req, res) => {
  try {
    const name = (req.body.name || "").trim();
    const lat = Number(req.body.lat);
    const lng = Number(req.body.lng);
    const radiusM = req.body.radius_m ? Number(req.body.radius_m) : 500;

    if (!name) {
      return res.status(400).json({ error: "Missing name" });
    }
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ error: "Missing or invalid lat/lng" });
    }

    const { rows } = await query(
      `INSERT INTO locations (id, name, lat, lng, radius_m, account_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, lat, lng, radius_m, created_at`,
      [uuid(), name, lat, lng, radiusM, req.account.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      // unique_violation on name
      return res.status(409).json({ error: "A location with that name already exists" });
    }
    console.error("Failed to create location:", err);
    res.status(500).json({ error: "Failed to create location" });
  }
});
