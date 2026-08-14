import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import request from 'supertest';
import { createApp } from '../dist/app.js';
import { createDatabase, runMigrations } from '../dist/db/index.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;

suite('API integration', () => {
  let pool;
  let db;
  let app;
  const config = {
    NODE_ENV: 'test', PORT: 3000, DATABASE_URL: databaseUrl,
    SESSION_PEPPER: 'integration-session-pepper-value',
    RECOVERY_PEPPER: 'integration-recovery-pepper-value',
    ADMIN_USERNAME: 'admin', ADMIN_PASSWORD: 'integration-admin-password', ADMIN_SESSION_SECRET: 'integration-admin-session-secret-value',
    CORS_ORIGINS: 'http://localhost:5173',
  };
  const save = { meta: { credits: 0, shards: 0, cores: 0, unlocked: 0, best: [0, 0, 0, 0, 0], prog: [0, 0, 0, 0, 0], cleared: [false, false, false, false, false], titanCore: false, perm: {}, shardOwned: {}, equippedShards: [], skillOwned: { parry: true, fracture: true }, equippedSkills: { tactical: 'parry', chrono: 'fracture' } }, settings: { volume: 1, shake: true, density: 2, reducedMotion: false } };

  before(async () => {
    ({ pool, db } = createDatabase(config));
    await runMigrations(db);
    app = createApp(db, config);
  });

  after(async () => { await pool?.end(); });

  it('creates, authenticates, recovers, deduplicates, and ranks a pilot', async () => {
    const created = await request(app).post('/api/v1/pilots').send({ displayName: 'TESTER', importedSave: save }).expect(201);
    const { sessionToken, recoveryCode } = created.body.data;
    await request(app).get('/api/v1/profile').set('Authorization', `Bearer ${sessionToken}`).expect(200);

    const adminLogin = await request(app).post('/api/v1/admin/login').send({ username: 'admin', password: 'integration-admin-password' }).expect(200);
    const adminToken = adminLogin.body.data.token;
    const pilotId = created.body.data.profile.id;
    await request(app).post(`/api/v1/admin/pilots/${pilotId}/grant`).set('Authorization', `Bearer ${adminToken}`).send({ credits: 500, shards: 2, cores: 0, reason: 'Integration test grant' }).expect(200);
    const granted = await request(app).get('/api/v1/profile').set('Authorization', `Bearer ${sessionToken}`).expect(200);
    assert.equal(granted.body.data.profile.save.meta.credits, 500);

    const run = { clientEventId: crypto.randomUUID(), score: 5000, sector: 1, wave: 5, mode: 'standard', level: 3, kills: 40, bossKills: 1, clearTime: 300, titan: false, save, baseRevision: 1 };
    await request(app).post('/api/v1/runs').set('Authorization', `Bearer ${sessionToken}`).send(run).expect(201);
    const duplicate = await request(app).post('/api/v1/runs').set('Authorization', `Bearer ${sessionToken}`).send(run).expect(200);
    assert.equal(duplicate.body.data.duplicate, true);
    const afterStaleRun = await request(app).get('/api/v1/profile').set('Authorization', `Bearer ${sessionToken}`).expect(200);
    assert.equal(afterStaleRun.body.data.profile.save.meta.credits, 500);

    const board = await request(app).get('/api/v1/leaderboard?limit=10').expect(200);
    assert.ok(board.body.data.entries.some(entry => entry.displayName === 'TESTER' && entry.score === 5000));

    const recovered = await request(app).post('/api/v1/pilots/recover').send({ recoveryCode }).expect(200);
    assert.notEqual(recovered.body.data.recoveryCode, recoveryCode);
    await request(app).post('/api/v1/pilots/recover').send({ recoveryCode }).expect(401);
  });
});
