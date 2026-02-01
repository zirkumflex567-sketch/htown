import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { env } from '../env';
import type { DbClient } from './client';

let gameDb: DbClient | null = null;

function createSqliteClient(sqlitePath: string): DbClient {
  const sqliteDir = path.dirname(sqlitePath);
  if (!fs.existsSync(sqliteDir)) {
    fs.mkdirSync(sqliteDir, { recursive: true });
  }
  const db = new Database(sqlitePath);
  db.pragma('journal_mode = WAL');

  const run = (sql: string, params: any[] = []) => {
    const stmt = db.prepare(sql);
    stmt.run(params);
  };
  const all = (sql: string, params: any[] = []) => {
    const stmt = db.prepare(sql);
    return stmt.all(params) as any[];
  };
  const get = (sql: string, params: any[] = []) => {
    const stmt = db.prepare(sql);
    return stmt.get(params) as any | undefined;
  };

  return {
    provider: 'sqlite',
    async query(sql, params = []) {
      return all(sql, params);
    },
    async get(sql, params = []) {
      return get(sql, params);
    },
    async exec(sql, params = []) {
      run(sql, params);
    },
    async close() {
      db.close();
    },
    async isConnected() {
      try {
        db.prepare('SELECT 1').get();
        return true;
      } catch {
        return false;
      }
    }
  };
}

export async function getGameDb() {
  if (!gameDb) {
    const pathFromEnv = env.gameDbPath || '/opt/htown/server/data/htown.sqlite';
    gameDb = createSqliteClient(pathFromEnv);
  }
  return gameDb;
}
