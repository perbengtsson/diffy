import type { DiffFile } from '../git/types.js';

/** Right border (1) + row paddingX (2). */
export const FILE_LIST_ROW_CHROME = 3;

/** Fixed chars reserved for stats when the old heuristic was used (too small once counts grow). */
export function formatFileStatsSuffix(file: Pick<DiffFile, 'additions' | 'deletions'>): string {
  const add = file.additions > 0 ? `+${file.additions}` : '';
  const del = file.deletions > 0 ? `-${file.deletions}` : '';
  if (!add && !del) return '';
  return ` ${add}${del}`;
}

export function truncateName(name: string, maxLen: number): string {
  if (maxLen <= 0) return '';
  if (name.length <= maxLen) return name;
  if (maxLen <= 3) return name.slice(0, maxLen);
  return '…' + name.slice(name.length - (maxLen - 1));
}

/**
 * Fit indent + tree prefix + label + optional stats into a single terminal row.
 * Prevents Ink text wrap, which Yoga then squeezes into overlapping lines.
 */
export function fitFileListRow(input: {
  width: number;
  depth: number;
  treePrefix: string;
  label: string;
  stats?: string;
}): { indent: string; treePrefix: string; label: string; stats: string } {
  const contentWidth = Math.max(1, input.width - FILE_LIST_ROW_CHROME);
  let indent = '│ '.repeat(input.depth);
  let treePrefix = input.treePrefix;
  let stats = input.stats ?? '';
  const minLabel = Math.min(4, input.label.length || 4);

  // Drop stats before clipping the name into unreadability.
  if (indent.length + treePrefix.length + minLabel + stats.length > contentWidth) {
    stats = '';
  }

  while (indent.length + treePrefix.length + minLabel > contentWidth) {
    if (indent.length > 0) {
      indent = indent.slice(2);
      continue;
    }
    if (treePrefix.length > 0) {
      treePrefix = '';
      continue;
    }
    break;
  }

  const gutterLen = indent.length + treePrefix.length;
  const labelWidth = Math.max(0, contentWidth - gutterLen - stats.length);
  return {
    indent,
    treePrefix,
    label: truncateName(input.label, labelWidth),
    stats,
  };
}
