import type { Request } from 'express';
import type { StoredSave } from './db/schema.js';
export interface AuthenticatedPilot { id: string; displayName: string; discriminator: string; saveData: StoredSave; bestScore: number; revision: number; suspended: boolean; leaderboardHidden: boolean; updatedAt: Date }
export interface AuthenticatedRequest extends Request { pilot?: AuthenticatedPilot; sessionId?: string }
export interface AdminRequest extends Request { adminName?: string }
