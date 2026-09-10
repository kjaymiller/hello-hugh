import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { pool } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const sql = readFileSync(
    path.join(__dirname, "..", "migrations", "001_init.sql"),
    "utf8"
  );
  // gen_random_uuid() needs pgcrypto on older Postgres; Aiven's default images
  // usually have it, but enable it defensively.
  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
  await pool.query(sql);
  console.log("Migration applied.");
  await pool.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
