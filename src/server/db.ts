import { Pool } from 'pg';

let pool: Pool | null = null;

export function getDb() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set.");
    }
    const useSsl = process.env.DB_SSL === 'true' || (process.env.NODE_ENV === 'production' && process.env.DB_SSL !== 'false');
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: useSsl ? { rejectUnauthorized: false } : false
    });
  }
  return pool;
}

export async function query(text: string, params?: any[]) {
  const db = getDb();
  return db.query(text, params);
}
