import type { DiffMode } from '../git/types.js';

/**
 * Diff side the comment is anchored to:
 * - old: deleted / pre-change line
 * - new: added / post-change line
 * - context: unchanged line present in both sides
 */
export type ReviewSide = 'old' | 'new' | 'context';

export type ReviewComment = {
  id: string;
  path: string;
  side: ReviewSide;
  line: number;
  body: string;
  snippet: string;
  updatedAt: string;
  /** When side is context and old≠new line numbers, the old-side line. */
  otherLine?: number;
};

export type ReviewSession = {
  version: 1;
  repoRoot: string;
  branch: string;
  date: string;
  mode?: DiffMode;
  comments: ReviewComment[];
};

export type LineTarget = {
  side: ReviewSide;
  line: number;
  snippet: string;
  otherLine?: number;
};
