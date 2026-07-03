export type FileStatus =
  | 'modified'
  | 'added'
  | 'deleted'
  | 'renamed'
  | 'untracked';

export type DiffMode =
  | { kind: 'uncommitted'; stagedOnly: boolean }
  | { kind: 'base'; base: string; includeUncommitted: boolean };

export type DiffFile = {
  path: string;
  status: FileStatus;
  additions: number;
  deletions: number;
  rawDiff: string;
  isBinary: boolean;
};

export type DiffSnapshot = {
  repoRoot: string;
  mode: DiffMode;
  files: DiffFile[];
  modeLabel: string;
};

export type LineSource = 'old' | 'new';

export type FileRevision = {
  /** null means read from working tree */
  ref: string | null;
  path: string;
};
