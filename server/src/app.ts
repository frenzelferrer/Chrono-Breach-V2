import { randomUUID } from 'node:crypto';
import cors from 'cors';
import { and, asc, desc, eq, gte, isNull, lte, or, sql } from 'drizzle-orm';
import express, { type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { ZodError } from 'zod';
import type { AppConfig } from './config.js';
import { registerAdminRoutes } from './admin.js';
import type { Database } from './db/index.js';
import { announcements, leaderboardEntries, pilots, runs, sessions } from './db/schema.js';
import { ApiError } from './errors.js';
import { shouldReplaceScore } from './logic.js';
import { publicProfile } from './profile.js';
import { hashSecret, newDiscriminator, newId, newRecoveryCode, newSessionToken, normalizeRecoveryCode } from './security.js';
import type { AuthenticatedPilot, AuthenticatedRequest } from './types.js';
import { createPilotSchema, isPlausibleRun, recoverPilotSchema, runSchema, updateSaveSchema } from './validation.js';

const asPilot = (row: typeof pilots.$inferSelect): AuthenticatedPilot => row;
const allowedOrigin = (origin: string, configured: string[]) => configured.some(item => item.endsWith('*') ? origin.startsWith(item.slice(0, -1)) : origin === item);

export function createApp(db: Database, config: AppConfig) {
  const app = express();
  const origins = config.CORS_ORIGINS.split(',').map(value => value.trim()).filter(Boolean);
  app.disable('x-powered-by'); app.set('trust proxy', 1); app.use(helmet());
  app.use(cors({ origin(origin, callback) { !origin || allowedOrigin(origin, origins) ? callback(null, true) : callback(new ApiError(403, 'ORIGIN_NOT_ALLOWED', 'Origin is not allowed')); } }));
  app.use(express.json({ limit: '128kb' }));
  app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false }));

  app.get('/health', async (_request, response, next) => { try { await db.execute(sql`select 1`); response.json({ data: { status: 'ok' } }); } catch (error) { next(error); } });
  registerAdminRoutes(app, db, config);

  app.get('/api/v1/announcements', async (_request, response, next) => {
    try {
      const now = new Date();
      const rows = await db.select().from(announcements).where(and(eq(announcements.active, true), or(isNull(announcements.startsAt), lte(announcements.startsAt, now)), or(isNull(announcements.endsAt), gte(announcements.endsAt, now)))).orderBy(desc(announcements.createdAt)).limit(5);
      response.json({ data: { announcements: rows } });
    } catch (error) { next(error); }
  });

  const authenticate = async (request: AuthenticatedRequest, _response: Response, next: NextFunction) => {
    try {
      const authorization = request.header('authorization');
      if (!authorization?.startsWith('Bearer ')) throw new ApiError(401, 'UNAUTHORIZED', 'Missing session token');
      const tokenHash = hashSecret(authorization.slice(7).trim(), config.SESSION_PEPPER);
      const found = await db.select({ session: sessions, pilot: pilots }).from(sessions).innerJoin(pilots, eq(sessions.pilotId, pilots.id)).where(eq(sessions.tokenHash, tokenHash)).limit(1);
      if (!found[0]) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid session token');
      if (found[0].pilot.suspended) throw new ApiError(403, 'ACCOUNT_SUSPENDED', 'This pilot account is suspended');
      request.pilot = asPilot(found[0].pilot); request.sessionId = found[0].session.id;
      void db.update(sessions).set({ lastSeenAt: new Date() }).where(eq(sessions.id, found[0].session.id)); next();
    } catch (error) { next(error); }
  };

  app.post('/api/v1/pilots', async (request, response, next) => {
    try {
      const body = createPilotSchema.parse(request.body), recoveryCode = newRecoveryCode(), sessionToken = newSessionToken(), now = new Date();
      const pilot = await db.transaction(async tx => {
        const inserted = await tx.insert(pilots).values({
          id: newId(), displayName: body.displayName.toUpperCase(), discriminator: newDiscriminator(), recoveryHash: hashSecret(normalizeRecoveryCode(recoveryCode), config.RECOVERY_PEPPER),
          saveData: body.importedSave, bestScore: Math.max(0, ...body.importedSave.meta.best), revision: 1, createdAt: now, updatedAt: now,
        }).returning();
        await tx.insert(sessions).values({ id: newId(), pilotId: inserted[0]!.id, tokenHash: hashSecret(sessionToken, config.SESSION_PEPPER) }); return inserted[0]!;
      });
      response.status(201).json({ data: { profile: publicProfile(asPilot(pilot)), sessionToken, recoveryCode } });
    } catch (error) { next(error); }
  });

  app.post('/api/v1/pilots/recover', async (request, response, next) => {
    try {
      const body = recoverPilotSchema.parse(request.body), recoveryHash = hashSecret(normalizeRecoveryCode(body.recoveryCode), config.RECOVERY_PEPPER), sessionToken = newSessionToken(), recoveryCode = newRecoveryCode();
      const pilot = await db.transaction(async tx => {
        const found = await tx.select().from(pilots).where(eq(pilots.recoveryHash, recoveryHash)).limit(1);
        if (!found[0]) throw new ApiError(401, 'INVALID_RECOVERY_CODE', 'Recovery code is invalid or already rotated');
        const updated = await tx.update(pilots).set({ recoveryHash: hashSecret(normalizeRecoveryCode(recoveryCode), config.RECOVERY_PEPPER), revision: sql`${pilots.revision} + 1`, updatedAt: new Date() }).where(eq(pilots.id, found[0].id)).returning();
        await tx.insert(sessions).values({ id: newId(), pilotId: found[0].id, tokenHash: hashSecret(sessionToken, config.SESSION_PEPPER) }); return updated[0]!;
      });
      response.json({ data: { profile: publicProfile(asPilot(pilot)), sessionToken, recoveryCode } });
    } catch (error) { next(error); }
  });

  app.get('/api/v1/profile', authenticate, (request: AuthenticatedRequest, response) => response.json({ data: { profile: publicProfile(request.pilot!) } }));

  app.patch('/api/v1/profile/save', authenticate, async (request: AuthenticatedRequest, response, next) => {
    try {
      const body = updateSaveSchema.parse(request.body);
      const where = body.baseRevision ? and(eq(pilots.id, request.pilot!.id), eq(pilots.revision, body.baseRevision)) : eq(pilots.id, request.pilot!.id);
      const updated = await db.update(pilots).set({ saveData: body.save, bestScore: Math.max(request.pilot!.bestScore, ...body.save.meta.best), revision: sql`${pilots.revision} + 1`, updatedAt: new Date() }).where(where).returning();
      if (!updated[0]) { const current = await db.select().from(pilots).where(eq(pilots.id, request.pilot!.id)).limit(1); response.json({ data: { profile: publicProfile(asPilot(current[0]!)), conflict: true } }); return; }
      response.json({ data: { profile: publicProfile(asPilot(updated[0])), conflict: false } });
    } catch (error) { next(error); }
  });

  app.post('/api/v1/profile/recovery-code', authenticate, async (request: AuthenticatedRequest, response, next) => {
    try {
      const recoveryCode = newRecoveryCode();
      await db.transaction(async tx => {
        await tx.delete(sessions).where(and(eq(sessions.pilotId, request.pilot!.id), sql`${sessions.id} <> ${request.sessionId!}`));
        await tx.update(pilots).set({ recoveryHash: hashSecret(normalizeRecoveryCode(recoveryCode), config.RECOVERY_PEPPER), revision: sql`${pilots.revision} + 1`, updatedAt: new Date() }).where(eq(pilots.id, request.pilot!.id));
      });
      response.json({ data: { recoveryCode } });
    } catch (error) { next(error); }
  });

  app.post('/api/v1/runs', rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false }), authenticate, async (request: AuthenticatedRequest, response, next) => {
    try {
      const run = runSchema.parse(request.body); if (!isPlausibleRun(run)) throw new ApiError(422, 'IMPLAUSIBLE_RUN', 'Run values exceed accepted game limits');
      const result = await db.transaction(async tx => {
        const inserted = await tx.insert(runs).values({ id: randomUUID(), pilotId: request.pilot!.id, clientEventId: run.clientEventId, score: run.score, sector: run.sector, wave: run.wave, mode: run.mode, level: run.level, kills: run.kills, bossKills: run.bossKills, clearTime: run.clearTime, titan: run.titan }).onConflictDoNothing().returning();
        if (!inserted[0]) { const current = await tx.select().from(pilots).where(eq(pilots.id, request.pilot!.id)).limit(1); return { pilot: current[0]!, duplicate: true }; }
        const currentPilot = await tx.select().from(pilots).where(eq(pilots.id, request.pilot!.id)).limit(1);
        const stale = run.baseRevision !== undefined && run.baseRevision !== currentPilot[0]!.revision;
        const updated = await tx.update(pilots).set({ ...(stale ? {} : { saveData: run.save }), bestScore: Math.max(currentPilot[0]!.bestScore, run.score), revision: sql`${pilots.revision} + 1`, updatedAt: new Date() }).where(eq(pilots.id, request.pilot!.id)).returning();
        for (const category of (run.titan ? ['scores', 'titan'] : ['scores']) as Array<'scores' | 'titan'>) {
          const current = await tx.select().from(leaderboardEntries).where(and(eq(leaderboardEntries.pilotId, request.pilot!.id), eq(leaderboardEntries.category, category))).limit(1);
          if (!current[0]) await tx.insert(leaderboardEntries).values({ pilotId: request.pilot!.id, category, runId: inserted[0].id, score: run.score });
          else if (shouldReplaceScore(current[0].score, run)) await tx.update(leaderboardEntries).set({ runId: inserted[0].id, score: run.score, achievedAt: new Date() }).where(and(eq(leaderboardEntries.pilotId, request.pilot!.id), eq(leaderboardEntries.category, category)));
        }
        return { pilot: updated[0]!, duplicate: false };
      });
      response.status(result.duplicate ? 200 : 201).json({ data: { profile: publicProfile(asPilot(result.pilot)), duplicate: result.duplicate } });
    } catch (error) { next(error); }
  });

  app.get('/api/v1/leaderboard', async (request, response, next) => {
    try {
      const category = request.query.mode === 'titan' ? 'titan' : 'scores', rawLimit = Number(request.query.limit ?? 10), limit = Number.isInteger(rawLimit) ? Math.min(50, Math.max(1, rawLimit)) : 10;
      const rows = await db.select({ displayName: pilots.displayName, discriminator: pilots.discriminator, score: runs.score, sector: runs.sector, wave: runs.wave, mode: runs.mode, level: runs.level, kills: runs.kills, bossKills: runs.bossKills, clearTime: runs.clearTime, titan: runs.titan, achievedAt: leaderboardEntries.achievedAt })
        .from(leaderboardEntries).innerJoin(pilots, eq(leaderboardEntries.pilotId, pilots.id)).innerJoin(runs, eq(leaderboardEntries.runId, runs.id)).where(and(eq(leaderboardEntries.category, category), eq(pilots.leaderboardHidden, false), eq(pilots.suspended, false))).orderBy(desc(leaderboardEntries.score), asc(leaderboardEntries.achievedAt)).limit(limit);
      response.json({ data: { entries: rows.map((row, index) => ({ ...row, rank: index + 1, achievedAt: row.achievedAt.toISOString() })) } });
    } catch (error) { next(error); }
  });

  app.use((_request, _response, next) => next(new ApiError(404, 'NOT_FOUND', 'Route not found')));
  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    if (error instanceof ZodError) { response.status(400).json({ error: { code: 'VALIDATION_ERROR', message: error.issues.map(issue => issue.message).join('; ') } }); return; }
    const apiError = error instanceof ApiError ? error : new ApiError(500, 'INTERNAL_ERROR', 'Unexpected server error'); if (apiError.status >= 500) console.error(error);
    response.status(apiError.status).json({ error: { code: apiError.code, message: apiError.message } });
  });
  return app;
}
