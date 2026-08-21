import path from 'node:path';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { asc, eq, lt } from 'drizzle-orm';
import type { AppConfig } from '../config.js';
import { isCallsignAllowed, NAME_MODERATION_VERSION } from '../moderation.js';
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

export async function refreshCallsignModeration(db: Database): Promise<number> {
  let updated = 0;
  for (;;) {
    const rows = await db.select({ id: schema.pilots.id, displayName: schema.pilots.displayName }).from(schema.pilots)
      .where(lt(schema.pilots.nameModerationVersion, NAME_MODERATION_VERSION)).orderBy(asc(schema.pilots.id)).limit(250);
    if (!rows.length) return updated;
    await db.transaction(async tx => {
      for (const row of rows) {
        await tx.update(schema.pilots).set({ nameFlagged: !isCallsignAllowed(row.displayName), nameModerationVersion: NAME_MODERATION_VERSION }).where(eq(schema.pilots.id, row.id));
      }
    });
    updated += rows.length;
  }
}
