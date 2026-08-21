import { createServer } from 'node:http';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createDatabase, refreshCallsignModeration, runMigrations } from './db/index.js';

const config = loadConfig();
const { db, pool } = createDatabase(config);
await runMigrations(db);
const moderatedPilots = await refreshCallsignModeration(db);
if (moderatedPilots) console.log(`Refreshed callsign moderation for ${moderatedPilots} pilot(s)`);

const server = createServer(createApp(db, config));
server.listen(config.PORT, '0.0.0.0', () => console.log(`CHRONO//BREACH API listening on ${config.PORT}`));

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
