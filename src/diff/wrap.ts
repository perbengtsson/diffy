import type { HighlightToken } from '../highlight/tokens.js';
import {
  needsScrollBar,
  scrollBarChromeWidth,
} from '../components/scrollBar.js';

/** old(4) + new(4) + separator(1) — must match DiffView gutter. */
export const DIFF_GUTTER_WIDTH = 9;

export type WrapLayout = {
  /** First visual row for each logical line (`rowStarts.length === lineCount`). */
  rowStarts: number[];
  totalRows: number;
};

export type DiffWrapLayout = WrapLayout & {
  contentWidth: number;
  linesWidth: number;
  showScrollBar: boolean;
};

/** How many visual rows a line of `contentLength` needs at `contentWidth`. */
export function wrappedRowCount(
  contentLength: number,
  contentWidth: number,
): number {
  if (contentWidth <= 0) return 1;
  if (contentLength <= 0) return 1;
  return Math.ceil(contentLength / contentWidth);
}

export function buildWrapLayout(
  lines: readonly { content: string }[],
  contentWidth: number,
): WrapLayout {
  const rowStarts: number[] = [];
  let totalRows = 0;
  for (const line of lines) {
    rowStarts.push(totalRows);
    totalRows += wrappedRowCount(line.content.length, contentWidth);
  }
  return { rowStarts, totalRows };
}

/**
 * Resolve content width + wrap layout, accounting for the scrollbar chrome
 * feedback loop (narrower pane → more wraps → still needs the bar).
 */
export function resolveDiffWrapLayout(
  lines: readonly { content: string }[],
  paneWidth: number,
  viewportHeight: number,
): DiffWrapLayout {
  const fullLinesWidth = Math.max(10, paneWidth);
  const fullContentWidth = Math.max(10, fullLinesWidth - DIFF_GUTTER_WIDTH);
  const fullLayout = buildWrapLayout(lines, fullContentWidth);
  const showScrollBar = needsScrollBar(fullLayout.totalRows, viewportHeight);
  const chrome = scrollBarChromeWidth(showScrollBar);
  const linesWidth = Math.max(10, paneWidth - chrome);
  const contentWidth = Math.max(10, linesWidth - DIFF_GUTTER_WIDTH);
  const layout =
    contentWidth === fullContentWidth
      ? fullLayout
      : buildWrapLayout(lines, contentWidth);
  return {
    ...layout,
    contentWidth,
    linesWidth,
    showScrollBar,
  };
}

export function logicalLineAtVisualRow(
  layout: WrapLayout,
  visualRow: number,
): number {
  const { rowStarts, totalRows } = layout;
  if (rowStarts.length === 0 || totalRows <= 0) return -1;
  if (visualRow < 0) return -1;
  if (visualRow >= totalRows) return -1;

  let lo = 0;
  let hi = rowStarts.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const start = rowStarts[mid]!;
    const end =
      mid + 1 < rowStarts.length ? rowStarts[mid + 1]! : totalRows;
    if (visualRow < start) hi = mid - 1;
    else if (visualRow >= end) lo = mid + 1;
    else return mid;
  }
  return -1;
}

export function visualRowRangeForLine(
  layout: WrapLayout,
  lineIndex: number,
): { start: number; end: number } {
  const start = layout.rowStarts[lineIndex];
  if (start === undefined) return { start: 0, end: 0 };
  const end =
    lineIndex + 1 < layout.rowStarts.length
      ? layout.rowStarts[lineIndex + 1]!
      : layout.totalRows;
  return { start, end };
}

/** Adjust scroll so `[rangeStart, rangeEnd)` stays visible when possible. */
export function scrollToShowRange(
  scroll: number,
  rangeStart: number,
  rangeEnd: number,
  viewportHeight: number,
  maxScroll: number,
): number {
  if (viewportHeight <= 0 || maxScroll <= 0) return 0;
  const height = Math.max(1, rangeEnd - rangeStart);
  if (height >= viewportHeight) {
    return Math.max(0, Math.min(maxScroll, rangeStart));
  }
  if (rangeStart < scroll) return rangeStart;
  if (rangeEnd > scroll + viewportHeight) {
    return Math.max(0, Math.min(maxScroll, rangeEnd - viewportHeight));
  }
  return scroll;
}

export function sliceTokens(
  tokens: HighlightToken[],
  start: number,
  length: number,
): HighlightToken[] {
  if (length <= 0) return [];
  const end = start + length;
  let pos = 0;
  const out: HighlightToken[] = [];

  for (const token of tokens) {
    const tokenEnd = pos + token.text.length;
    if (tokenEnd <= start) {
      pos = tokenEnd;
      continue;
    }
    if (pos >= end) break;
    const sliceStart = Math.max(0, start - pos);
    const sliceEnd = Math.min(token.text.length, end - pos);
    if (sliceStart < sliceEnd) {
      out.push({
        text: token.text.slice(sliceStart, sliceEnd),
        className: token.className,
      });
    }
    pos = tokenEnd;
  }

  return out;
}

export function wrapSegmentOffset(
  wrapRow: number,
  contentWidth: number,
): number {
  return Math.max(0, wrapRow) * Math.max(1, contentWidth);
}
