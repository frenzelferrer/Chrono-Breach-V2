import { z } from 'zod';

export const settingsSchema = z.object({ volume: z.number().finite().min(0).max(1), shake: z.boolean(), density: z.number().int().min(0).max(2), reducedMotion: z.boolean() });
export const metaSchema = z.object({
  credits: z.number().int().min(0).max(2_000_000_000), shards: z.number().int().min(0).max(2_000_000_000), cores: z.number().int().min(0).max(1_000_000), unlocked: z.number().int().min(0).max(4),
  best: z.array(z.number().int().min(0).max(100_000_000)).length(5), prog: z.array(z.number().int().min(0).max(1000)).length(5), cleared: z.array(z.boolean()).length(5), titanCore: z.boolean(),
  perm: z.record(z.string(), z.number().int().min(0).max(20)), shardOwned: z.record(z.string(), z.boolean()), equippedShards: z.array(z.string().max(40)).max(3),
  skillOwned: z.record(z.string(), z.boolean()), equippedSkills: z.record(z.string(), z.string().max(40)),
}).passthrough();
export const saveSchema = z.object({ meta: metaSchema, settings: settingsSchema });
export const createPilotSchema = z.object({ displayName: z.string().trim().min(2).max(12).regex(/^[A-Za-z0-9_-]+$/), importedSave: saveSchema });
export const recoverPilotSchema = z.object({ recoveryCode: z.string().trim().min(20).max(40) });
export const updateSaveSchema = z.object({ save: saveSchema, baseRevision: z.number().int().positive().optional() });
export const runSchema = z.object({
  clientEventId: z.string().uuid(), score: z.number().int().min(0).max(100_000_000), sector: z.number().int().min(1).max(5), wave: z.number().int().min(1).max(1000),
  mode: z.enum(['standard', 'endless']), level: z.number().int().min(1).max(5), kills: z.number().int().min(0).max(100_000), bossKills: z.number().int().min(0).max(1000),
  clearTime: z.number().finite().min(0).max(86_400), titan: z.boolean(), paradox: z.boolean().default(false), eternalLevel: z.number().int().min(0).max(10_000).default(0), save: saveSchema, baseRevision: z.number().int().positive().optional(),
}).refine(run => !run.titan || run.sector === 5, { message: 'Titan records require sector 5', path: ['titan'] })
  .refine(run => !run.paradox || run.titan, { message: 'Paradox records require a Titan clear', path: ['paradox'] })
  .refine(run => run.eternalLevel === 0 || run.paradox, { message: 'Eternal levels require a Paradox record', path: ['eternalLevel'] });

export type RunInput = z.infer<typeof runSchema>;
export function isPlausibleRun(run: RunInput): boolean {
  return run.score <= Math.max(2_000_000, run.wave * run.sector * 750_000) && run.bossKills <= (run.mode === 'endless' ? 1000 : 1);
}

export const adminLoginSchema = z.object({ username: z.string().min(2).max(40), password: z.string().min(1).max(200) });
export const adminGrantSchema = z.object({ credits: z.number().int().min(-2_000_000_000).max(2_000_000_000).default(0), shards: z.number().int().min(-2_000_000_000).max(2_000_000_000).default(0), cores: z.number().int().min(-1_000_000).max(1_000_000).default(0), reason: z.string().trim().min(3).max(200) }).refine(value => value.credits !== 0 || value.shards !== 0 || value.cores !== 0, 'At least one grant amount is required');
export const adminPilotUpdateSchema = z.object({ displayName: z.string().trim().min(2).max(12).regex(/^[A-Za-z0-9_-]+$/).optional(), unlocked: z.number().int().min(0).max(4).optional(), titanCore: z.boolean().optional(), suspended: z.boolean().optional(), leaderboardHidden: z.boolean().optional(), reason: z.string().trim().min(3).max(200) });
export const adminPilotDeleteSchema = z.object({ confirmTag: z.string().trim().min(3).max(17), reason: z.string().trim().min(3).max(200) });
export const announcementSchema = z.object({ title: z.string().trim().min(2).max(80), message: z.string().trim().min(2).max(500), severity: z.enum(['info', 'success', 'warning', 'critical']).default('info'), active: z.boolean().default(true), startsAt: z.string().datetime().nullable().optional(), endsAt: z.string().datetime().nullable().optional() });
export const announcementUpdateSchema = announcementSchema.partial().refine(value => Object.keys(value).length > 0, 'No announcement fields supplied');
