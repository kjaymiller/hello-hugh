import { Router } from "express";
import { query } from "../db.js";
import { generateApiKey, requireAdmin } from "../middleware/auth.js";

export const router = Router();

router.use(requireAdmin);

const PUBLIC_COLUMNS = `slug, name, api_key_prefix, (api_key_hash IS NOT NULL) AS has_key,
  created_at, revoked_at`;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,30}$/;

router.get("/accounts", async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT ${PUBLIC_COLUMNS} FROM accounts ORDER BY created_at ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error("Failed to list accounts:", err);
    res.status(500).json({ error: "Failed to list accounts" });
  }
});

// Creates an account and returns its API key — the only time it's visible.
router.post("/accounts", async (req, res) => {
  try {
    const slug = String(req.body.slug || "").trim().toLowerCase();
    const name = String(req.body.name || "").trim();
    if (!SLUG_RE.test(slug)) {
      return res.status(400).json({
        error: "slug must be 2-31 chars: lowercase letters, digits, hyphens",
      });
    }
    if (!name) {
      return res.status(400).json({ error: "Missing name" });
    }

    const { key, hash, prefix } = generateApiKey();
    const { rows } = await query(
      `INSERT INTO accounts (slug, name, api_key_hash, api_key_prefix)
       VALUES ($1, $2, $3, $4) RETURNING ${PUBLIC_COLUMNS}`,
      [slug, name, hash, prefix]
    );
    res.status(201).json({ ...rows[0], api_key: key });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "An account with that slug already exists" });
    }
    console.error("Failed to create account:", err);
    res.status(500).json({ error: "Failed to create account" });
  }
});

// Issues a new key (invalidating the old one) and reactivates a revoked
// account. Also how Hugh's account gets its first key.
router.post("/accounts/:slug/rotate-key", async (req, res) => {
  try {
    const { key, hash, prefix } = generateApiKey();
    const { rows } = await query(
      `UPDATE accounts SET api_key_hash = $1, api_key_prefix = $2, revoked_at = NULL
       WHERE slug = $3 RETURNING ${PUBLIC_COLUMNS}`,
      [hash, prefix, req.params.slug]
    );
    if (!rows.length) return res.status(404).json({ error: "No such account" });
    res.json({ ...rows[0], api_key: key });
  } catch (err) {
    console.error("Failed to rotate key:", err);
    res.status(500).json({ error: "Failed to rotate key" });
  }
});

// Soft-revoke: the key and (for hugh) the session stop working, but the
// account's check-ins stay. Undo with rotate-key.
router.delete("/accounts/:slug", async (req, res) => {
  try {
    const { rows } = await query(
      `UPDATE accounts SET revoked_at = COALESCE(revoked_at, now())
       WHERE slug = $1 RETURNING ${PUBLIC_COLUMNS}`,
      [req.params.slug]
    );
    if (!rows.length) return res.status(404).json({ error: "No such account" });
    res.json(rows[0]);
  } catch (err) {
    console.error("Failed to revoke account:", err);
    res.status(500).json({ error: "Failed to revoke account" });
  }
});
