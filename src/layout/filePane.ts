/** Minimum columns for the file list pane. */
export const MIN_FILE_PANE_WIDTH = 20;
/** Minimum columns reserved for the diff pane. */
export const MIN_DIFF_PANE_WIDTH = 30;
/** Extra columns around the border that count as a drag hit. */
export const SPLIT_BORDER_HIT_SLACK = 1;

/** Default file-pane width from terminal size (and optional left picker). */
export function defaultFilePaneWidth(
  columns: number,
  leftPickerOpen: boolean,
): number {
  const preferred = leftPickerOpen
    ? Math.max(40, Math.min(56, Math.floor(columns * 0.42)))
    : Math.max(25, Math.min(37, Math.floor(columns * 0.28) + 5));
  return clampFilePaneWidth(preferred, columns);
}

/** Clamp a file-pane width so both panes stay usable. */
export function clampFilePaneWidth(width: number, columns: number): number {
  const max = Math.max(MIN_FILE_PANE_WIDTH, columns - MIN_DIFF_PANE_WIDTH);
  return Math.max(MIN_FILE_PANE_WIDTH, Math.min(max, Math.round(width)));
}

/**
 * Effective file-pane width. Collapsed hides the pane (width 0) unless a left
 * picker (themes) needs it.
 */
export function resolveFilePaneWidth(options: {
  columns: number;
  collapsed: boolean;
  leftPickerOpen: boolean;
  userWidth: number | null;
}): number {
  const { columns, collapsed, leftPickerOpen, userWidth } = options;
  if (collapsed && !leftPickerOpen) return 0;
  if (leftPickerOpen) return defaultFilePaneWidth(columns, true);
  return clampFilePaneWidth(
    userWidth ?? defaultFilePaneWidth(columns, false),
    columns,
  );
}

/**
 * True when (x, y) is on the vertical split between file and diff panes.
 * Coordinates are 1-based SGR mouse cells; the border is the last column of
 * the file pane (`x === filePaneWidth`).
 */
export function isSplitBorderHit(
  x: number,
  y: number,
  filePaneWidth: number,
  contentHeight: number,
): boolean {
  if (y < 1 || y > contentHeight) return false;
  return Math.abs(x - filePaneWidth) <= SPLIT_BORDER_HIT_SLACK;
}
