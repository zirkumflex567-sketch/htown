import Database from 'better-sqlite3';
import { Pool } from 'pg';
import { env } from '../env';
import fs from 'fs';
import path from 'path';

export type DbProvider = 'sqlite' | 'postgres';

export type DbClient = {
  provider: DbProvider;
  query: <T = any>(sql: string, params?: any[]) => Promise<T[]>;
  get: <T = any>(sql: string, params?: any[]) => Promise<T | undefined>;
  exec: (sql: string, params?: any[]) => Promise<void>;
  close: () => Promise<void>;
  isConnected: () => Promise<boolean>;
};

const replaceParams = (provider: DbProvider, sql: string) => {
  if (provider === 'sqlite') return sql;
  let index = 0;
  return sql.replace(/\?/g, () => {
    index += 1;
    return `$${index}`;
  });
};

export async function createDbClient(): Promise<DbClient> {
  const provider = env.dbProvider;
  if (provider === 'postgres') {
    if (!env.postgresUrl) {
      throw new Error('ADMIN_POSTGRES_URL is required when ADMIN_DB_PROVIDER=postgres');
    }
    const pool = new Pool({ connectionString: env.postgresUrl });
    return {
      provider,
      async query(sql, params = []) {
        const text = replaceParams(provider, sql);
        const result = await pool.query(text, params);
        return result.rows as any[];
      },
      async get(sql, params = []) {
        const rows = await this.query(sql, params);
        return rows[0];
      },
      async exec(sql, params = []) {
        const text = replaceParams(provider, sql);
        await pool.query(text, params);
      },
      async close() {
        await pool.end();
      },
      async isConnected() {
        try {
          await pool.query('SELECT 1');
          return true;
        } catch {
          return false;
        }
      }
    } as DbClient;
  }

  const sqliteDir = path.dirname(env.sqlitePath);
  if (!fs.existsSync(sqliteDir)) {
    fs.mkdirSync(sqliteDir, { recursive: true });
  }
  const db = new Database(env.sqlitePath);
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
    provider,
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
