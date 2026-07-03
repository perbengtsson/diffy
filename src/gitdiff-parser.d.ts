declare module 'gitdiff-parser' {
  export interface Change {
    content: string;
    type: 'insert' | 'delete' | 'normal';
    lineNumber?: number;
    oldLineNumber?: number;
    newLineNumber?: number;
  }

  export interface Hunk {
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    changes: Change[];
  }

  export interface File {
    hunks: Hunk[];
    oldPath: string;
    newPath: string;
    type: 'add' | 'delete' | 'modify' | 'rename';
    isBinary?: boolean;
  }

  const gitDiffParser: {
    parse(source: string): File[];
  };

  export default gitDiffParser;
}
