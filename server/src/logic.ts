import type { RunInput } from './validation.js';
export function shouldReplaceScore(currentScore: number | undefined, run: Pick<RunInput, 'score'>): boolean { return currentScore === undefined || run.score > currentScore; }
