import path from 'node:path';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { AppConfig } from '../config.js';
import * as schema from './schema.js';

export function createDatabase(config: AppConfig) {
  const pool = new pg.Pool({
    connectionString: config.DATABASE_URL,
    ssl: config.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    max: 5,
  });
  const db = drizzle(pool, { schema });
  return { pool, db };
}

export type Database = ReturnType<typeof createDatabase>['db'];

export async function runMigrations(db: Database): Promise<void> {
  await migrate(db, { migrationsFolder: path.resolve(process.cwd(), 'drizzle') });
}
