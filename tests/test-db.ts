import { execSync } from "node:child_process";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
// The MAIN production database host. Tests must never run against it.
const MAIN_DB_MARKER = "lufznscapqcbkefzkqdp";

/**
 * Points the app at the TEST database (TEST_DATABASE_URL in .env), creates the tables,
 * and empties every table so each test file starts clean.
 * Refuses to run if TEST_DATABASE_URL is missing or points at the main database.
 */
export async function setupTestDb() {
  try {
    process.loadEnvFile(path.join(ROOT, ".env"));
  } catch {
    // .env missing: the check below will fail with a clear message.
  }
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set in .env. See docs/DEPLOYMENT.md.");
  if (url.includes(MAIN_DB_MARKER)) throw new Error("Refusing to run tests: TEST_DATABASE_URL points to the MAIN database.");

  process.env.DATABASE_URL = url;
  process.env.DIRECT_URL = url;

  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    cwd: ROOT,
    env: process.env,
    stdio: "ignore",
  });

  const { db } = await import("@/lib/db");
  const tables = await db.$queryRawUnsafe<{ tablename: string }[]>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'",
  );
  if (tables.length > 0) {
    const names = tables.map((t) => `"${t.tablename}"`).join(", ");
    await db.$executeRawUnsafe(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`);
  }
}
