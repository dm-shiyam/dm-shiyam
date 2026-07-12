// Runs schema.sql against the Postgres DB specified by DATABASE_URL
import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, "..", "schema.sql");
const schema = fs.readFileSync(schemaPath, "utf-8");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL env var not set");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  console.log("→ Connecting to Postgres...");
  await client.connect();
  console.log("✅ Connected. Running schema...");
  await client.query(schema);
  console.log("✅ Schema applied successfully!");

  const { rows } = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `);
  console.log(`\n📋 Tables created (${rows.length}):`);
  rows.forEach((r) => console.log("   -", r.table_name));
} catch (err) {
  console.error("❌ Error:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
