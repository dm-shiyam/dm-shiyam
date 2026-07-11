import { Pool } from "pg";

declare global {
  // Prevent multiple Pool instances in Next.js dev hot-reload
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  return new Pool({
    connectionString,
    // Railway / Render terminate idle connections aggressively
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    // Required for Neon / Supabase / Railway SSL
    ssl: process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
  });
}

// Reuse pool across hot-reloads in dev; create fresh in prod
export const pool: Pool =
  global._pgPool ?? (global._pgPool = createPool());

/** Run a query and return rows */
export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const { rows } = await pool.query(sql, params);
  return rows as T[];
}

/** Run a query and return the first row (or undefined) */
export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T | undefined> {
  const rows = await query<T>(sql, params);
  return rows[0];
}

/** Run a query and return rowCount */
export async function execute(
  sql: string,
  params?: unknown[]
): Promise<number> {
  const result = await pool.query(sql, params);
  return result.rowCount ?? 0;
}