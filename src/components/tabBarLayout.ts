import type { FileTab } from '../files/tabs.js';

export type TabHit = {
  path: string;
  pinned: boolean;
  label: string;
  x0: number;
  x1: number;
  closeX0: number;
  closeX1: number;
};

const CLOSE = '×';
const PAD = 1; // spaces around label

export function basename(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1] || path;
}

function truncateLabel(label: string, maxLen: number): string {
  if (label.length <= maxLen) return label;
  if (maxLen <= 1) return label.slice(0, maxLen);
  return '…' + label.slice(label.length - (maxLen - 1));
}

/** Lay out tabs left-to-right in absolute pane-local x (0-based). */
export function layoutTabBar(tabs: FileTab[], width: number): TabHit[] {
  const hits: TabHit[] = [];
  let x = 0;

  for (const tab of tabs) {
    if (x >= width) break;

    const closeWidth = 1 + CLOSE.length; // space + ×
    const minWidth = 2 + closeWidth; // at least one char label + close
    const remaining = width - x;
    if (remaining < minWidth) break;

    const maxLabel = remaining - PAD * 2 - closeWidth;
    const label = truncateLabel(basename(tab.path), maxLabel);
    const inner = PAD + label.length + PAD + closeWidth;
    const x0 = x;
    const x1 = x + inner - 1;
    const closeX1 = x1;
    const closeX0 = closeX1 - CLOSE.length + 1;

    hits.push({
      path: tab.path,
      pinned: tab.pinned,
      label,
      x0,
      x1,
      closeX0,
      closeX1,
    });
    x = x1 + 1;
  }

  return hits;
}

export function hitTestTab(
  hits: TabHit[],
  x: number,
): { path: string; close: boolean } | null {
  for (const hit of hits) {
    if (x < hit.x0 || x > hit.x1) continue;
    const close = x >= hit.closeX0 && x <= hit.closeX1;
    return { path: hit.path, close };
  }
  return null;
}
