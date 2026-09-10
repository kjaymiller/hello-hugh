import pg from "pg";

const { Pool } = pg;

function buildPoolConfig() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error("DATABASE_URL is not set");
  }

  // When running as an Aiven Application service, PROJECT_CA_CERT (the
  // Aiven project CA, base64-encoded) is injected alongside DATABASE_URL.
  // pg v8 ignores the `ssl` option whenever `sslmode` is present in the
  // connection string, so leaving sslmode=require in the URL means pg falls
  // back to Node's default TLS verification, which doesn't know Aiven's CA
  // and fails with SELF_SIGNED_CERT_IN_CHAIN. Strip it and verify against
  // the provided CA explicitly instead.
  if (process.env.PROJECT_CA_CERT) {
    const url = new URL(raw);
    url.searchParams.delete("sslmode");
    return {
      connectionString: url.toString(),
      ssl: {
        ca: Buffer.from(process.env.PROJECT_CA_CERT, "base64").toString("utf8"),
        rejectUnauthorized: true,
      },
    };
  }

  // Local dev / manual runs: sslmode in the URL (require, for the real
  // Aiven service; absent, for the local postgis container) is sufficient.
  return { connectionString: raw };
}

export const pool = new Pool(buildPoolConfig());

export async function query(text, params) {
  return pool.query(text, params);
}
