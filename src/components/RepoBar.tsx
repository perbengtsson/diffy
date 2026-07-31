import { Box, Text } from 'ink';
import type { Theme } from '../theme.js';

type Props = {
  name: string;
  width: number;
  theme: Theme;
  /** When true, full tree; when false, changed files only. */
  showUnedited: boolean;
};

export const REPO_MODE_LABEL = 'All/Diff';
/** Minimum spaces between repo name and right-aligned mode label. */
const MIN_GAP = 2;

function truncateName(name: string, maxLen: number): string {
  if (maxLen <= 0) return '';
  if (name.length <= maxLen) return name;
  if (maxLen <= 3) return name.slice(0, maxLen);
  return '…' + name.slice(name.length - (maxLen - 1));
}

/**
 * Pane-local 0-based inclusive range for the right-aligned mode label.
 * Matches RepoBar paint: paddingX(1) + content + paddingX(1) + borderRight(1).
 */
export function repoModeHitRange(
  width: number,
): { x0: number; x1: number } | null {
  const contentWidth = Math.max(0, width - 3);
  if (contentWidth < REPO_MODE_LABEL.length) return null;
  const x1 = width - 3;
  const x0 = x1 - REPO_MODE_LABEL.length + 1;
  return { x0, x1 };
}

export function hitTestRepoMode(width: number, localX: number): boolean {
  const range = repoModeHitRange(width);
  if (!range) return false;
  return localX >= range.x0 && localX <= range.x1;
}

export function RepoBar({ name, width, theme, showUnedited }: Props) {
  const contentWidth = Math.max(1, width - 3);
  const showMode = contentWidth >= REPO_MODE_LABEL.length;
  const nameWidth = showMode
    ? Math.max(0, contentWidth - REPO_MODE_LABEL.length - MIN_GAP)
    : contentWidth;

  return (
    <Box
      width={width}
      height={1}
      borderStyle="single"
      borderTop={false}
      borderBottom={false}
      borderLeft={false}
      borderRight
      borderColor={theme.borderFg}
      paddingX={1}
      justifyContent="space-between"
    >
      <Text bold color={theme.defaultFg}>
        {truncateName(name, nameWidth)}
      </Text>
      {showMode ? (
        <Text color={theme.defaultFg}>
          <Text bold={showUnedited}>All</Text>
          <Text>/</Text>
          <Text bold={!showUnedited}>Diff</Text>
        </Text>
      ) : null}
    </Box>
  );
}
