import type { AuthenticatedPilot } from './types.js';
export function publicProfile(pilot: AuthenticatedPilot) { return { id: pilot.id, displayName: pilot.displayName, discriminator: pilot.discriminator, save: pilot.saveData, bestScore: pilot.bestScore, revision: pilot.revision, suspended: pilot.suspended, requiresRename: pilot.requiresRename, updatedAt: pilot.updatedAt.toISOString() }; }
