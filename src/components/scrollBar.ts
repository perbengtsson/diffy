import type { DisplayLine } from '../diff/types.js';

export type ScrollMark = 'none' | 'add' | 'delete' | 'both';

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
