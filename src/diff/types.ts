export type DisplayLineKind =
  | 'hunk-header'
  | 'add'
  | 'delete'
  | 'context'
  | 'expanded-context'
  | 'file-header'
  | 'binary';

export type DisplayLine = {
  kind: DisplayLineKind;
  content: string;
  oldLineNo?: number;
  newLineNo?: number;
  hunkId?: string;
  side?: 'old' | 'new';
};

export type HunkExpansion = {
  before: number;
  after: number;
};

export type HunkMeta = {
  id: string;
  index: number;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  oldPath: string;
  newPath: string;
};
