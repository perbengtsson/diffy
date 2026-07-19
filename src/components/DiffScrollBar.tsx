import { Box, Text } from 'ink';
import type { DisplayLine } from '../diff/types.js';
import type { Theme } from '../theme.js';
import {
  buildScrollMarks,
  viewportThumbRange,
  type ScrollMark,
} from './scrollBar.js';

type Props = {
  lines: DisplayLine[];
  scrollOffset: number;
  viewportHeight: number;
  height: number;
  theme: Theme;
};

function markColor(mark: ScrollMark, theme: Theme, inViewport: boolean): string {
  switch (mark) {
    case 'add':
      return theme.addedFg;
    case 'delete':
      return theme.removedFg;
    case 'both':
      return 'yellow';
    default:
      return inViewport ? theme.defaultFg : theme.dimFg;
  }
}

function markChar(mark: ScrollMark, inViewport: boolean): string {
  // Right-biased glyphs so the track sits flush on the terminal edge.
  if (inViewport) return '█';
  if (mark === 'none') return '▕';
  return '▐';
}

export function DiffScrollBar({
  lines,
  scrollOffset,
  viewportHeight,
  height,
  theme,
}: Props) {
  const trackHeight = Math.max(1, height);
  const marks = buildScrollMarks(lines, trackHeight);
  const thumb = viewportThumbRange(scrollOffset, viewportHeight, lines.length, trackHeight);

  return (
    <Box flexDirection="column" height={height} width={1}>
      {marks.map((mark, row) => {
        const inViewport = row >= thumb.start && row < thumb.end;
        return (
          <Text
            key={row}
            color={markColor(mark, theme, inViewport)}
            dimColor={mark === 'none' && !inViewport}
            backgroundColor={inViewport && mark === 'none' ? theme.borderFg : undefined}
          >
            {markChar(mark, inViewport)}
          </Text>
        );
      })}
    </Box>
  );
}
