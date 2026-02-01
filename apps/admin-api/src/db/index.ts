import { createDbClient, DbClient } from './client';
import { schemaStatements, indexStatements } from './schema';

let dbClient: DbClient | null = null;

export async function initDb() {
  if (!dbClient) {
    dbClient = await createDbClient();
    for (const stmt of schemaStatements) {
      await dbClient.exec(stmt);
    }
    for (const stmt of indexStatements) {
      await dbClient.exec(stmt);
    }
  }
  return dbClient;
}

export function getDb() {
  if (!dbClient) {
    throw new Error('Database not initialized');
  }
  return dbClient;
}

export async function closeDb() {
  if (dbClient) {
    await dbClient.close();
    dbClient = null;
  }
}
