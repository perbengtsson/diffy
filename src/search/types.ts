export type SearchScope = 'file' | 'all';

export type SearchMatch = {
  filePath: string;
  lineIndex: number;
};

export type SearchState = {
  open: boolean;
  scope: SearchScope;
  query: string;
  matchIndex: number;
};
