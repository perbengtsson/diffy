import type { DisplayLine } from '../diff/types.js';

export const SCROLLBAR_WIDTH = 1;
/** Blank column between diff content and the scrollbar track. */
export const SCROLLBAR_GAP = 1;
export const SCROLLBAR_HIT_WIDTH = 3;

/** Total columns reserved on the right when the scrollbar is shown. */
export function scrollBarChromeWidth(visible: boolean): number {
  return visible ? SCROLLBAR_WIDTH + SCROLLBAR_GAP : 0;
}

export type ScrollMark = 'none' | 'add' | 'delete' | 'both';

export function isScrollBarHit(
  x: number,
  y: number,
  layout: {
    columns: number;
    filePaneWidth: number;
    contentHeight: number;
    /** Visual row count (soft-wrapped), used for scrollbar visibility. */
    totalLines: number;
  },
): boolean {
  const { columns, filePaneWidth, contentHeight, totalLines } = layout;
  if (!needsScrollBar(totalLines, contentHeight)) return false;

  const diffRight = columns;
  const diffLeft = filePaneWidth + 1;
  const hitLeft = Math.max(diffLeft, diffRight - SCROLLBAR_HIT_WIDTH + 1);
  return x >= hitLeft && x <= diffRight && y >= 1 && y <= contentHeight;
}

export function needsScrollBar(totalLines: number, viewportHeight: number): boolean {
  return totalLines > viewportHeight;
}

export function buildScrollMarks(
  lines: DisplayLine[],
  trackHeight: number,
): ScrollMark[] {
  const total = lines.length;
  if (total === 0 || trackHeight <= 0) return [];

  const marks: ScrollMark[] = [];
  for (let row = 0; row < trackHeight; row++) {
    const start = Math.floor((row * total) / trackHeight);
    const end = Math.floor(((row + 1) * total) / trackHeight);
    let hasAdd = false;
    let hasDelete = false;

    for (let i = start; i < end; i++) {
      const kind = lines[i]?.kind;
      if (kind === 'add') hasAdd = true;
      if (kind === 'delete') hasDelete = true;
    }

    if (hasAdd && hasDelete) marks.push('both');
    else if (hasAdd) marks.push('add');
    else if (hasDelete) marks.push('delete');
    else marks.push('none');
  }

  return marks;
}

export function viewportThumbRange(
  scrollOffset: number,
  viewportHeight: number,
  totalLines: number,
  trackHeight: number,
): { start: number; end: number } {
  if (totalLines <= 0 || trackHeight <= 0) {
    return { start: 0, end: 0 };
  }

  const start = Math.floor((scrollOffset / totalLines) * trackHeight);
  const end = Math.ceil(((scrollOffset + viewportHeight) / totalLines) * trackHeight);
  return {
    start,
    end: Math.min(trackHeight, Math.max(start + 1, end)),
  };
}

export function scrollOffsetFromTrackRow(
  row: number,
  viewportHeight: number,
  totalLines: number,
  trackHeight: number,
): number {
  const maxScroll = Math.max(0, totalLines - viewportHeight);
  if (maxScroll === 0 || trackHeight <= 1) return 0;

  const clampedRow = Math.max(0, Math.min(trackHeight - 1, row));
  return Math.round((clampedRow / (trackHeight - 1)) * maxScroll);
}

/** Scroll offset that places `lineIndex` as close to vertical center as possible. */
export function centeredScrollOffset(
  lineIndex: number,
  viewportHeight: number,
  totalLines: number,
): number {
  const maxScroll = Math.max(0, totalLines - viewportHeight);
  if (maxScroll === 0 || viewportHeight <= 0) return 0;
  const centered = lineIndex - Math.floor(viewportHeight / 2);
  return Math.max(0, Math.min(maxScroll, centered));
}
