import path from 'node:path';
import { and, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import type { Express, NextFunction, Response } from 'express';
import rateLimit from 'express-rate-limit';
import type { AppConfig } from './config.js';
import type { Database } from './db/index.js';
import { adminAuditLogs, announcements, leaderboardEntries, pilots, runs, sessions } from './db/schema.js';
import { ApiError } from './errors.js';
import { isCallsignAllowed, NAME_MODERATION_VERSION } from './moderation.js';
import { createAdminToken, newId, safeEqual, verifyAdminToken } from './security.js';
import type { AdminRequest } from './types.js';
import { adminForceRenameSchema, adminGrantSchema, adminLoginSchema, adminPilotDeleteSchema, adminPilotUpdateSchema, announcementSchema, announcementUpdateSchema } from './validation.js';

export function registerAdminRoutes(app: Express, db: Database, config: AppConfig): void {
  const publicDir = path.resolve(process.cwd(), 'public');
  app.get('/admin', (_request, response) => response.sendFile(path.join(publicDir, 'admin.html')));
  app.get('/admin-assets/admin.css', (_request, response) => response.sendFile(path.join(publicDir, 'admin.css')));
  app.get('/admin-assets/admin.js', (_request, response) => response.sendFile(path.join(publicDir, 'admin.js')));

  app.post('/api/v1/admin/login', rateLimit({ windowMs: 15 * 60_000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false }), (request, response, next) => {
    try {
      const body = adminLoginSchema.parse(request.body);
      if (!safeEqual(body.username, config.ADMIN_USERNAME) || !safeEqual(body.password, config.ADMIN_PASSWORD)) throw new ApiError(401, 'INVALID_ADMIN_CREDENTIALS', 'Invalid administrator credentials');
      response.json({ data: { token: createAdminToken(config.ADMIN_USERNAME, config.ADMIN_SESSION_SECRET), expiresIn: 28_800, admin: config.ADMIN_USERNAME } });
    } catch (error) { next(error); }
  });

  const authenticateAdmin = (request: AdminRequest, _response: Response, next: NextFunction) => {
    const header = request.header('authorization');
    const adminName = header?.startsWith('Bearer ') ? verifyAdminToken(header.slice(7).trim(), config.ADMIN_SESSION_SECRET) : null;
    if (!adminName) { next(new ApiError(401, 'ADMIN_UNAUTHORIZED', 'Admin session is missing or expired')); return; }
    request.adminName = adminName; next();
  };
  const audit = async (adminName: string, action: string, pilotId: string | null, details: Record<string, unknown>) => {
    await db.insert(adminAuditLogs).values({ id: newId(), adminName, action, pilotId, details });
  };

  app.get('/api/v1/admin/overview', authenticateAdmin, async (_request, response, next) => {
    try {
      const [pilotTotal, runTotal, sessionTotal, suspendedTotal, moderationTotal, activeAnnouncements] = await Promise.all([
        db.select({ value: count() }).from(pilots), db.select({ value: count() }).from(runs), db.select({ value: count() }).from(sessions),
        db.select({ value: count() }).from(pilots).where(eq(pilots.suspended, true)), db.select({ value: count() }).from(pilots).where(or(eq(pilots.nameFlagged, true), eq(pilots.requiresRename, true))),
        db.select({ value: count() }).from(announcements).where(eq(announcements.active, true)),
      ]);
      response.json({ data: { pilots: pilotTotal[0]!.value, runs: runTotal[0]!.value, sessions: sessionTotal[0]!.value, suspended: suspendedTotal[0]!.value, moderationPending: moderationTotal[0]!.value, activeAnnouncements: activeAnnouncements[0]!.value } });
    } catch (error) { next(error); }
  });

  app.get('/api/v1/admin/pilots', authenticateAdmin, async (request, response, next) => {
    try {
      const q = String(request.query.q ?? '').trim(), page = Math.max(1, Number(request.query.page) || 1), limit = Math.min(100, Math.max(1, Number(request.query.limit) || 25));
      const searchFilter = q ? or(ilike(pilots.displayName, `%${q}%`), ilike(pilots.discriminator, `%${q}%`), sql`${pilots.id}::text ILIKE ${`%${q}%`}`) : undefined;
      const moderationFilter = request.query.moderation === 'flagged' ? or(eq(pilots.nameFlagged, true), eq(pilots.requiresRename, true)) : undefined;
      const filter = searchFilter && moderationFilter ? and(searchFilter, moderationFilter) : searchFilter ?? moderationFilter;
      const [rows, totals] = await Promise.all([
        db.select({ id: pilots.id, displayName: pilots.displayName, discriminator: pilots.discriminator, save: pilots.saveData, bestScore: pilots.bestScore, revision: pilots.revision, suspended: pilots.suspended, leaderboardHidden: pilots.leaderboardHidden, nameFlagged: pilots.nameFlagged, requiresRename: pilots.requiresRename, createdAt: pilots.createdAt, updatedAt: pilots.updatedAt }).from(pilots).where(filter).orderBy(desc(pilots.updatedAt)).limit(limit).offset((page - 1) * limit),
        db.select({ value: count() }).from(pilots).where(filter),
      ]);
      response.json({ data: { pilots: rows, page, limit, total: totals[0]!.value } });
    } catch (error) { next(error); }
  });

  app.get('/api/v1/admin/pilots/:id', authenticateAdmin, async (request, response, next) => {
    try {
      const [pilot, recentRuns, auditRows] = await Promise.all([
        db.select().from(pilots).where(eq(pilots.id, String(request.params.id))).limit(1),
        db.select().from(runs).where(eq(runs.pilotId, String(request.params.id))).orderBy(desc(runs.createdAt)).limit(20),
        db.select().from(adminAuditLogs).where(eq(adminAuditLogs.pilotId, String(request.params.id))).orderBy(desc(adminAuditLogs.createdAt)).limit(20),
      ]);
      if (!pilot[0]) throw new ApiError(404, 'PILOT_NOT_FOUND', 'Pilot not found');
      response.json({ data: { pilot: pilot[0], runs: recentRuns, audit: auditRows } });
    } catch (error) { next(error); }
  });

  app.post('/api/v1/admin/pilots/:id/grant', authenticateAdmin, async (request: AdminRequest, response, next) => {
    try {
      const body = adminGrantSchema.parse(request.body), found = await db.select().from(pilots).where(eq(pilots.id, String(request.params.id))).limit(1);
      if (!found[0]) throw new ApiError(404, 'PILOT_NOT_FOUND', 'Pilot not found');
      const save = structuredClone(found[0].saveData), before = { credits: save.meta.credits, shards: save.meta.shards, cores: save.meta.cores };
      save.meta.credits = Math.max(0, save.meta.credits + body.credits); save.meta.shards = Math.max(0, save.meta.shards + body.shards); save.meta.cores = Math.max(0, save.meta.cores + body.cores);
      const updated = await db.update(pilots).set({ saveData: save, revision: sql`${pilots.revision} + 1`, updatedAt: new Date() }).where(eq(pilots.id, found[0].id)).returning();
      await audit(request.adminName!, 'pilot.economy_grant', found[0].id, { before, delta: { credits: body.credits, shards: body.shards, cores: body.cores }, after: { credits: save.meta.credits, shards: save.meta.shards, cores: save.meta.cores }, reason: body.reason });
      response.json({ data: { pilot: updated[0] } });
    } catch (error) { next(error); }
  });

  app.patch('/api/v1/admin/pilots/:id', authenticateAdmin, async (request: AdminRequest, response, next) => {
    try {
      const body = adminPilotUpdateSchema.parse(request.body), found = await db.select().from(pilots).where(eq(pilots.id, String(request.params.id))).limit(1);
      if (!found[0]) throw new ApiError(404, 'PILOT_NOT_FOUND', 'Pilot not found');
      const save = structuredClone(found[0].saveData);
      if (body.unlocked !== undefined) save.meta.unlocked = body.unlocked;
      if (body.titanCore !== undefined) save.meta.titanCore = body.titanCore;
      const displayName = body.displayName?.toUpperCase() ?? found[0].displayName, nameChanged = displayName !== found[0].displayName;
      if (nameChanged && !isCallsignAllowed(displayName)) throw new ApiError(422, 'CALLSIGN_NOT_ALLOWED', 'Choose a different callsign');
      const updated = await db.update(pilots).set({ saveData: save, displayName, ...(nameChanged ? { nameFlagged: false, requiresRename: false, nameModerationVersion: NAME_MODERATION_VERSION } : {}), suspended: body.suspended ?? found[0].suspended, leaderboardHidden: body.leaderboardHidden ?? found[0].leaderboardHidden, revision: sql`${pilots.revision} + 1`, updatedAt: new Date() }).where(eq(pilots.id, found[0].id)).returning();
      await audit(request.adminName!, 'pilot.update', found[0].id, { changes: body, before: { displayName: found[0].displayName, unlocked: found[0].saveData.meta.unlocked, titanCore: found[0].saveData.meta.titanCore, suspended: found[0].suspended, leaderboardHidden: found[0].leaderboardHidden } });
      response.json({ data: { pilot: updated[0] } });
    } catch (error) { next(error); }
  });

  app.post('/api/v1/admin/pilots/:id/revoke-sessions', authenticateAdmin, async (request: AdminRequest, response, next) => {
    try {
      const pilotId = String(request.params.id);
      const found = await db.select({ id: pilots.id }).from(pilots).where(eq(pilots.id, pilotId)).limit(1);
      if (!found[0]) throw new ApiError(404, 'PILOT_NOT_FOUND', 'Pilot not found');
      const deleted = await db.delete(sessions).where(eq(sessions.pilotId, pilotId)).returning({ id: sessions.id });
      await audit(request.adminName!, 'pilot.sessions_revoked', pilotId, { sessionsRevoked: deleted.length });
      response.json({ data: { sessionsRevoked: deleted.length } });
    } catch (error) { next(error); }
  });

  app.post('/api/v1/admin/pilots/:id/force-rename', authenticateAdmin, async (request: AdminRequest, response, next) => {
    try {
      const pilotId = String(request.params.id), body = adminForceRenameSchema.parse(request.body);
      const found = await db.select().from(pilots).where(eq(pilots.id, pilotId)).limit(1);
      if (!found[0]) throw new ApiError(404, 'PILOT_NOT_FOUND', 'Pilot not found');
      if (found[0].requiresRename) throw new ApiError(409, 'CALLSIGN_RENAME_ALREADY_REQUIRED', 'This pilot already has a pending callsign change');
      const previousTag = `${found[0].displayName}#${found[0].discriminator}`;
      const updated = await db.update(pilots).set({ displayName: 'PILOT', nameFlagged: false, requiresRename: true, nameModerationVersion: NAME_MODERATION_VERSION, revision: sql`${pilots.revision} + 1`, updatedAt: new Date() }).where(eq(pilots.id, pilotId)).returning();
      await audit(request.adminName!, 'pilot.force_rename', pilotId, { previousTag, temporaryTag: `PILOT#${found[0].discriminator}`, reason: body.reason });
      response.json({ data: { pilot: updated[0] } });
    } catch (error) { next(error); }
  });

  app.delete('/api/v1/admin/pilots/:id', authenticateAdmin, async (request: AdminRequest, response, next) => {
    try {
      const pilotId = String(request.params.id), body = adminPilotDeleteSchema.parse(request.body);
      const deletedAccount = await db.transaction(async tx => {
        const found = await tx.select().from(pilots).where(eq(pilots.id, pilotId)).limit(1);
        if (!found[0]) throw new ApiError(404, 'PILOT_NOT_FOUND', 'Pilot not found');
        const pilot = found[0], expectedTag = `${pilot.displayName}#${pilot.discriminator}`;
        if (body.confirmTag.toUpperCase() !== expectedTag.toUpperCase()) throw new ApiError(400, 'PILOT_DELETE_CONFIRMATION_MISMATCH', `Type ${expectedTag} to confirm deletion`);
        const [runTotal, sessionTotal, leaderboardTotal] = await Promise.all([
          tx.select({ value: count() }).from(runs).where(eq(runs.pilotId, pilotId)),
          tx.select({ value: count() }).from(sessions).where(eq(sessions.pilotId, pilotId)),
          tx.select({ value: count() }).from(leaderboardEntries).where(eq(leaderboardEntries.pilotId, pilotId)),
        ]);
        const cascade = { runs: runTotal[0]!.value, sessions: sessionTotal[0]!.value, leaderboardEntries: leaderboardTotal[0]!.value };
        await tx.insert(adminAuditLogs).values({
          id: newId(), adminName: request.adminName!, action: 'pilot.delete', pilotId: null,
          details: { deletedPilotId: pilot.id, displayName: pilot.displayName, discriminator: pilot.discriminator, bestScore: pilot.bestScore, createdAt: pilot.createdAt.toISOString(), cascade, reason: body.reason },
        });
        const deleted = await tx.delete(pilots).where(eq(pilots.id, pilotId)).returning({ id: pilots.id });
        if (!deleted[0]) throw new ApiError(409, 'PILOT_DELETE_CONFLICT', 'Pilot account changed before it could be deleted');
        return { id: pilot.id, displayName: pilot.displayName, discriminator: pilot.discriminator, cascade };
      });
      response.json({ data: { deleted: true, pilot: deletedAccount } });
    } catch (error) { next(error); }
  });

  app.get('/api/v1/admin/announcements', authenticateAdmin, async (_request, response, next) => { try { response.json({ data: { announcements: await db.select().from(announcements).orderBy(desc(announcements.createdAt)) } }); } catch (error) { next(error); } });
  app.post('/api/v1/admin/announcements', authenticateAdmin, async (request: AdminRequest, response, next) => {
    try { const body = announcementSchema.parse(request.body), created = await db.insert(announcements).values({ id: newId(), ...body, startsAt: body.startsAt ? new Date(body.startsAt) : null, endsAt: body.endsAt ? new Date(body.endsAt) : null }).returning(); await audit(request.adminName!, 'announcement.create', null, { id: created[0]!.id, title: body.title }); response.status(201).json({ data: { announcement: created[0] } }); } catch (error) { next(error); }
  });
  app.patch('/api/v1/admin/announcements/:id', authenticateAdmin, async (request: AdminRequest, response, next) => {
    try { const body = announcementUpdateSchema.parse(request.body), updated = await db.update(announcements).set({ ...body, startsAt: body.startsAt === undefined ? undefined : body.startsAt ? new Date(body.startsAt) : null, endsAt: body.endsAt === undefined ? undefined : body.endsAt ? new Date(body.endsAt) : null, updatedAt: new Date() }).where(eq(announcements.id, String(request.params.id))).returning(); if (!updated[0]) throw new ApiError(404, 'ANNOUNCEMENT_NOT_FOUND', 'Announcement not found'); await audit(request.adminName!, 'announcement.update', null, { id: updated[0].id, changes: body }); response.json({ data: { announcement: updated[0] } }); } catch (error) { next(error); }
  });
  app.get('/api/v1/admin/audit', authenticateAdmin, async (_request, response, next) => { try { response.json({ data: { audit: await db.select().from(adminAuditLogs).orderBy(desc(adminAuditLogs.createdAt)).limit(100) } }); } catch (error) { next(error); } });
}
