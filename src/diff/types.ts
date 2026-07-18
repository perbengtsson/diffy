export type DisplayLineKind =
  | 'hunk-header'
  | 'add'
  | 'delete'
  | 'context'
  | 'file-header'
  | 'binary';

export type DisplayLine = {
  kind: DisplayLineKind;
  content: string;
  oldLineNo?: number;
  newLineNo?: number;
  side?: 'old' | 'new';
};
