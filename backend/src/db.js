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

  // Local dev / manual runs against the real Aiven service directly (no
  // PROJECT_CA_CERT, since we're not on Aiven's Application runtime): newer
  // pg-connection-string treats sslmode=require as an alias for
  // verify-full, which fails against Aiven's CA with SELF_SIGNED_CERT_IN_CHAIN
  // since we have no CA to verify against here. uselibpqcompat=true
  // restores the traditional libpq meaning of `require` — encrypt, don't
  // verify the chain — which is fine for a POC talking directly to a
  // known Aiven service. Not needed for the local postgis container
  // (no sslmode in that URL at all).
  const url = new URL(raw);
  if (url.searchParams.get("sslmode") === "require") {
    url.searchParams.set("uselibpqcompat", "true");
  }
  return { connectionString: url.toString() };
}

export const pool = new Pool(buildPoolConfig());

export async function query(text, params) {
  return pool.query(text, params);
}
