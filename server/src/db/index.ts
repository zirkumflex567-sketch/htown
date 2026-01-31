import { SqliteDatabase } from "./sqlite";
import { PostgresDatabase } from "./postgres";
import type { Database } from "./types";

export async function createDatabase(): Promise<Database> {
  const mode = process.env.DB_MODE ?? "sqlite";
  if (mode === "postgres") {
    const connectionString = process.env.DATABASE_URL ?? "postgres://postgres:postgres@db:5432/htown";
    const db = new PostgresDatabase(connectionString);
    await db.init();
    return db;
  }
  const filePath = process.env.SQLITE_FILE ?? "./data/dev.db";
  const db = new SqliteDatabase(filePath);
  await db.init();
  return db;
}
