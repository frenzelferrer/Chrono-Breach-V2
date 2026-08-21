import { boolean, index, integer, jsonb, pgTable, primaryKey, real, smallint, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

export interface StoredSettings { volume: number; shake: boolean; density: number; reducedMotion: boolean }
export interface StoredMeta {
  credits: number; shards: number; cores: number; unlocked: number;
  best: number[]; prog: number[]; cleared: boolean[]; titanCore: boolean;
  paradoxCore?: boolean; paradoxDefeats?: number; paradoxFragments?: number; ngPlusUnlocked?: boolean; bestEternal?: number; bestEternalScore?: number;
  perm: Record<string, number>; shardOwned: Record<string, boolean>; equippedShards: string[];
  skillOwned: Record<string, boolean>; equippedSkills: Record<string, string>;
}
export interface StoredSave { meta: StoredMeta; settings: StoredSettings }

export const pilots = pgTable('pilots', {
  id: uuid('id').primaryKey(), displayName: varchar('display_name', { length: 12 }).notNull(),
  discriminator: varchar('discriminator', { length: 4 }).notNull(), recoveryHash: varchar('recovery_hash', { length: 64 }).notNull().unique(),
  saveData: jsonb('save_data').$type<StoredSave>().notNull(), bestScore: integer('best_score').notNull().default(0), revision: integer('revision').notNull().default(1),
  suspended: boolean('suspended').notNull().default(false), leaderboardHidden: boolean('leaderboard_hidden').notNull().default(false),
  nameFlagged: boolean('name_flagged').notNull().default(false), requiresRename: boolean('requires_rename').notNull().default(false), nameModerationVersion: integer('name_moderation_version').notNull().default(0),
  recoveryRequestedAt: timestamp('recovery_requested_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [index('pilots_name_moderation_idx').on(table.nameFlagged, table.requiresRename), index('pilots_recovery_request_idx').on(table.recoveryRequestedAt)]);

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey(), pilotId: uuid('pilot_id').notNull().references(() => pilots.id, { onDelete: 'cascade' }), tokenHash: varchar('token_hash', { length: 64 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(), lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex('sessions_token_idx').on(table.tokenHash), index('sessions_pilot_idx').on(table.pilotId)]);

export const runs = pgTable('runs', {
  id: uuid('id').primaryKey(), pilotId: uuid('pilot_id').notNull().references(() => pilots.id, { onDelete: 'cascade' }), clientEventId: uuid('client_event_id').notNull(),
  score: integer('score').notNull(), sector: smallint('sector').notNull(), wave: integer('wave').notNull(), mode: varchar('mode', { length: 8 }).$type<'standard' | 'endless'>().notNull(),
  level: smallint('level').notNull(), kills: integer('kills').notNull(), bossKills: integer('boss_kills').notNull(), clearTime: real('clear_time').notNull(), titan: boolean('titan').notNull().default(false), paradox: boolean('paradox').notNull().default(false), eternalLevel: smallint('eternal_level').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex('runs_pilot_event_idx').on(table.pilotId, table.clientEventId), index('runs_pilot_idx').on(table.pilotId, table.createdAt)]);

export const leaderboardEntries = pgTable('leaderboard_entries', {
  pilotId: uuid('pilot_id').notNull().references(() => pilots.id, { onDelete: 'cascade' }), category: varchar('category', { length: 8 }).$type<'scores' | 'titan' | 'paradox'>().notNull(),
  runId: uuid('run_id').notNull().references(() => runs.id, { onDelete: 'cascade' }), score: integer('score').notNull(), achievedAt: timestamp('achieved_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [primaryKey({ columns: [table.pilotId, table.category] }), index('leaderboard_score_idx').on(table.category, table.score, table.achievedAt)]);

export const announcements = pgTable('announcements', {
  id: uuid('id').primaryKey(), title: varchar('title', { length: 80 }).notNull(), message: varchar('message', { length: 500 }).notNull(),
  severity: varchar('severity', { length: 12 }).$type<'info' | 'success' | 'warning' | 'critical'>().notNull().default('info'), active: boolean('active').notNull().default(true),
  startsAt: timestamp('starts_at', { withTimezone: true }), endsAt: timestamp('ends_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [index('announcements_active_idx').on(table.active, table.startsAt, table.endsAt)]);

export const adminAuditLogs = pgTable('admin_audit_logs', {
  id: uuid('id').primaryKey(), adminName: varchar('admin_name', { length: 40 }).notNull(), action: varchar('action', { length: 80 }).notNull(),
  pilotId: uuid('pilot_id').references(() => pilots.id, { onDelete: 'set null' }), details: jsonb('details').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [index('admin_audit_created_idx').on(table.createdAt)]);
