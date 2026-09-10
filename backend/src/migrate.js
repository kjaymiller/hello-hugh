import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { pool } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, "..", "migrations");

async function main() {
  // gen_random_uuid() needs pgcrypto on older Postgres; Aiven's default images
  // usually have it, but enable it defensively.
  await pool.query("CREATE EXTENSION IF NOT EXISTS pgcrypto;");

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort(); // filenames are numerically prefixed (001_, 002_, ...)

  for (const file of files) {
    const sql = readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    console.log(`Applying ${file}...`);
    await pool.query(sql);
  }

  console.log("Migrations applied.");
  await pool.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
