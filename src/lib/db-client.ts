import { Pool, PoolClient } from "pg";

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

// Lazy pool getter — only creates on first use (allows build without DATABASE_URL)
function getPool(): Pool {
  if (!global._pgPool) {
    global._pgPool = createPool();
  }
  return global._pgPool;
}

// Proxy that lazily initializes the pool on first property access
export const pool: Pool = new Proxy({} as Pool, {
  get(_target, prop) {
    const actualPool = getPool();
    const value = actualPool[prop as keyof Pool];
    return typeof value === "function" ? value.bind(actualPool) : value;
  },
});

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

/**
 * Run a series of queries inside a transaction using a dedicated pooled
 * client. Automatically COMMITs on success or ROLLBACKs on throw. Required
 * for advisory-lock patterns and any multi-statement atomicity guarantee.
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}