import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import request from 'supertest';
import { createApp } from '../dist/app.js';
import { createDatabase, refreshCallsignModeration, runMigrations } from '../dist/db/index.js';
import { pilots } from '../dist/db/schema.js';
import { eq } from 'drizzle-orm';

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
    await request(app).post('/api/v1/pilots').send({ displayName: 'F_U_C_K', importedSave: save }).expect(422);
    const created = await request(app).post('/api/v1/pilots').send({ displayName: 'TESTER', importedSave: save }).expect(201);
    const { sessionToken } = created.body.data;
    let { recoveryCode } = created.body.data;
    const pilotId = created.body.data.profile.id;
    await request(app).get('/api/v1/profile').set('Authorization', `Bearer ${sessionToken}`).expect(200);

    const adminLogin = await request(app).post('/api/v1/admin/login').send({ username: 'admin', password: 'integration-admin-password' }).expect(200);
    const adminToken = adminLogin.body.data.token;
    await request(app).post('/api/v1/profile/recovery-assistance').set('Authorization', `Bearer ${sessionToken}`).expect(200);
    const requestedProfile = await request(app).get('/api/v1/profile').set('Authorization', `Bearer ${sessionToken}`).expect(200);
    assert.equal(requestedProfile.body.data.profile.recoveryAssistanceRequested, true);
    const recoveryQueue = await request(app).get('/api/v1/admin/pilots?recovery=requested').set('Authorization', `Bearer ${adminToken}`).expect(200);
    assert.ok(recoveryQueue.body.data.pilots.some(entry => entry.id === pilotId));
    const adminDetail = await request(app).get(`/api/v1/admin/pilots/${pilotId}`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    assert.equal(adminDetail.body.data.pilot.recoveryHash, undefined);
    const reissued = await request(app).post(`/api/v1/admin/pilots/${pilotId}/reissue-recovery-code`).set('Authorization', `Bearer ${adminToken}`).send({ reason: 'Player verified through support' }).expect(200);
    assert.match(reissued.body.data.recoveryCode, /^CB-[A-F0-9]{6}(?:-[A-F0-9]{6}){3}$/);
    await request(app).post('/api/v1/pilots/recover').send({ recoveryCode }).expect(401);
    recoveryCode = reissued.body.data.recoveryCode;
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

    await db.update(pilots).set({ displayName: 'YAWA', nameModerationVersion: 0 }).where(eq(pilots.id, pilotId));
    assert.equal(await refreshCallsignModeration(db), 1);
    const hiddenBoard = await request(app).get('/api/v1/leaderboard?limit=10').expect(200);
    assert.ok(!hiddenBoard.body.data.entries.some(entry => entry.discriminator === created.body.data.profile.discriminator));
    const moderationQueue = await request(app).get('/api/v1/admin/pilots?moderation=flagged').set('Authorization', `Bearer ${adminToken}`).expect(200);
    assert.ok(moderationQueue.body.data.pilots.some(pilot => pilot.id === pilotId && pilot.nameFlagged));

    await request(app).post(`/api/v1/admin/pilots/${pilotId}/force-rename`).set('Authorization', `Bearer ${adminToken}`).send({ reason: 'Inappropriate callsign integration test' }).expect(200);
    const renameRequired = await request(app).get('/api/v1/profile').set('Authorization', `Bearer ${sessionToken}`).expect(200);
    assert.equal(renameRequired.body.data.profile.requiresRename, true);
    assert.equal(renameRequired.body.data.profile.displayName, 'PILOT');
    await request(app).patch('/api/v1/profile/save').set('Authorization', `Bearer ${sessionToken}`).send({ save }).expect(409);
    await request(app).post('/api/v1/runs').set('Authorization', `Bearer ${sessionToken}`).send({ ...run, clientEventId: crypto.randomUUID() }).expect(409);
    await request(app).patch('/api/v1/profile/callsign').set('Authorization', `Bearer ${sessionToken}`).send({ displayName: 'PUTANGINA' }).expect(422);
    const renamed = await request(app).patch('/api/v1/profile/callsign').set('Authorization', `Bearer ${sessionToken}`).send({ displayName: 'STARCADE' }).expect(200);
    assert.equal(renamed.body.data.profile.requiresRename, false);
    assert.equal(renamed.body.data.profile.displayName, 'STARCADE');
    const restoredBoard = await request(app).get('/api/v1/leaderboard?limit=10').expect(200);
    assert.ok(restoredBoard.body.data.entries.some(entry => entry.displayName === 'STARCADE' && entry.score === 5000));

    const recovered = await request(app).post('/api/v1/pilots/recover').send({ recoveryCode }).expect(200);
    assert.notEqual(recovered.body.data.recoveryCode, recoveryCode);
    await request(app).post('/api/v1/pilots/recover').send({ recoveryCode }).expect(401);

    const pilotTag = `STARCADE#${created.body.data.profile.discriminator}`;
    await request(app).delete(`/api/v1/admin/pilots/${pilotId}`).set('Authorization', `Bearer ${adminToken}`).send({ confirmTag: 'WRONG#0000', reason: 'Integration deletion test' }).expect(400);
    const deletion = await request(app).delete(`/api/v1/admin/pilots/${pilotId}`).set('Authorization', `Bearer ${adminToken}`).send({ confirmTag: pilotTag, reason: 'Integration deletion test' }).expect(200);
    assert.equal(deletion.body.data.deleted, true);
    assert.equal(deletion.body.data.pilot.cascade.runs, 1);
    assert.ok(deletion.body.data.pilot.cascade.sessions >= 2);
    await request(app).get('/api/v1/profile').set('Authorization', `Bearer ${sessionToken}`).expect(401);
    await request(app).get(`/api/v1/admin/pilots/${pilotId}`).set('Authorization', `Bearer ${adminToken}`).expect(404);
    const boardAfterDeletion = await request(app).get('/api/v1/leaderboard?limit=10').expect(200);
    assert.ok(!boardAfterDeletion.body.data.entries.some(entry => entry.displayName === 'STARCADE'));
    const audit = await request(app).get('/api/v1/admin/audit').set('Authorization', `Bearer ${adminToken}`).expect(200);
    assert.ok(audit.body.data.audit.some(entry => entry.action === 'pilot.force_rename'));
    assert.ok(audit.body.data.audit.some(entry => entry.action === 'pilot.recovery_code_reissued'));
    assert.ok(audit.body.data.audit.some(entry => entry.action === 'pilot.delete' && entry.details.deletedPilotId === pilotId));
  });
});
