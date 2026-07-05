import type { DiffFile } from '../git/types.js';
import { isEditedFile } from './tree.js';

export type FileTypeSummary = {
  label: string;
  fileCount: number;
  additions: number;
  deletions: number;
};

export type ChangeSummary = {
  fileCount: number;
  totalAdditions: number;
  totalDeletions: number;
  byType: FileTypeSummary[];
};

export function fileTypeLabel(filePath: string): string {
  const base = filePath.split('/').pop()?.toLowerCase() ?? '';
  const dot = base.lastIndexOf('.');
  if (dot > 0) return base.slice(dot + 1);
  if (base === 'makefile' || base === 'gnumakefile') return 'make';
  return base || 'other';
}

export function buildChangeSummary(files: DiffFile[]): ChangeSummary {
  const edited = files.filter(isEditedFile);
  const byType = new Map<string, FileTypeSummary>();

  let totalAdditions = 0;
  let totalDeletions = 0;

  for (const file of edited) {
    totalAdditions += file.additions;
    totalDeletions += file.deletions;

    const label = fileTypeLabel(file.path);
    const current = byType.get(label) ?? {
      label,
      fileCount: 0,
      additions: 0,
      deletions: 0,
    };
    byType.set(label, {
      label,
      fileCount: current.fileCount + 1,
      additions: current.additions + file.additions,
      deletions: current.deletions + file.deletions,
    });
  }

  const types = [...byType.values()].sort((a, b) => {
    const deltaA = a.additions + a.deletions;
    const deltaB = b.additions + b.deletions;
    if (deltaB !== deltaA) return deltaB - deltaA;
    if (b.fileCount !== a.fileCount) return b.fileCount - a.fileCount;
    return a.label.localeCompare(b.label);
  });

  return {
    fileCount: edited.length,
    totalAdditions,
    totalDeletions,
    byType: types,
  };
}
