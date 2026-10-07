import crypto from "node:crypto";
import { query } from "../db.js";

const HUGH_SLUG = "hugh";

export function hashKey(key) {
  return crypto.createHash("sha256").update(key).digest("hex");
}

/** A new random API key, plus the hash and prefix that get stored. */
export function generateApiKey() {
  const key = `hh_${crypto.randomBytes(32).toString("base64url")}`;
  return { key, hash: hashKey(key), prefix: key.slice(0, 11) };
}

function presentedKey(req) {
  const bearer = /^Bearer\s+(.+)$/i.exec(req.get("authorization") || "");
  return (bearer && bearer[1].trim()) || req.get("x-api-key") || null;
}

/**
 * Resolves the calling account and sets `req.account` ({ id, slug, name }).
 * Accepts an account API key (`Authorization: Bearer <key>` or `X-API-Key`),
 * or Hugh's browser session, which maps to the 'hugh' account. Revoked
 * accounts are rejected either way.
 */
export async function requireAccount(req, res, next) {
  try {
    const key = presentedKey(req);
    let rows;
    if (key) {
      ({ rows } = await query(
        `SELECT id, slug, name FROM accounts
         WHERE api_key_hash = $1 AND revoked_at IS NULL`,
        [hashKey(key)]
      ));
    } else if (req.session && req.session.authenticated) {
      ({ rows } = await query(
        `SELECT id, slug, name FROM accounts
         WHERE slug = $1 AND revoked_at IS NULL`,
        [HUGH_SLUG]
      ));
    } else {
      return res.status(401).json({ error: "Not authenticated" });
    }
    if (!rows.length) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    req.account = rows[0];
    next();
  } catch (err) {
    console.error("Auth lookup failed:", err);
    res.status(500).json({ error: "Authentication failed" });
  }
}

/** Guards /api/admin/*. Disabled entirely unless ADMIN_API_KEY is set. */
export function requireAdmin(req, res, next) {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) {
    return res.status(503).json({ error: "Admin API is not configured" });
  }
  const key = presentedKey(req);
  // Compare fixed-length digests so length can't leak through timing.
  const ok =
    key &&
    crypto.timingSafeEqual(
      Buffer.from(hashKey(key), "hex"),
      Buffer.from(hashKey(expected), "hex")
    );
  if (!ok) {
    return res.status(401).json({ error: "Invalid admin key" });
  }
  next();
}

export function login(req, res) {
  const { password } = req.body || {};
  if (!password || password !== process.env.HUGH_PASSWORD) {
    return res.status(401).json({ error: "Incorrect password" });
  }
  req.session.authenticated = true;
  res.json({ ok: true });
}

export function logout(req, res) {
  req.session = null;
  res.json({ ok: true });
}

export function sessionStatus(req, res) {
  res.json({ authenticated: Boolean(req.session && req.session.authenticated) });
}
