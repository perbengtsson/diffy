import { Box, Text } from 'ink';
import type { ReviewComment } from '../review/types.js';
import type { Theme } from '../theme.js';

type Props = {
  comments: ReviewComment[];
  selectedIndex: number;
  height: number;
  width: number;
  theme: Theme;
  branch: string;
  date: string;
};

export function ReviewOverview({
  comments,
  selectedIndex,
  height,
  width,
  theme,
  branch,
  date,
}: Props) {
  const header = `Review overview — ${branch} — ${date} (${comments.length})`;
  const hints = '↑/↓:nav Enter:jump o/Esc:close';
  const listHeight = Math.max(1, height - 2);

  const start = Math.max(
    0,
    Math.min(selectedIndex - Math.floor(listHeight / 2), comments.length - listHeight),
  );
  const visible = comments.slice(start, start + listHeight);

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Text bold color={theme.statusFg}>
        {header.length > width ? header.slice(0, Math.max(1, width - 1)) + '…' : header}
      </Text>
      {comments.length === 0 ? (
        <Text dimColor color={theme.dimFg}>
          No comments yet. Press c on a diff line to add one.
        </Text>
      ) : (
        <Box flexDirection="column" height={listHeight}>
          {visible.map((c, i) => {
            const index = start + i;
            const selected = index === selectedIndex;
            const preview =
              c.body.length > 60 ? `${c.body.slice(0, 59)}…` : c.body;
            const row = `${c.path}:${c.line} (${c.side})  ${preview}`;
            const text =
              row.length > width ? `${row.slice(0, Math.max(1, width - 1))}…` : row;
            return (
              <Text
                key={c.id}
                bold={selected}
                backgroundColor={selected ? theme.selectedBg : undefined}
                color={selected ? theme.selectedFg : theme.defaultFg}
              >
                {text}
              </Text>
            );
          })}
        </Box>
      )}
      <Text dimColor color={theme.dimFg}>
        {hints}
      </Text>
    </Box>
  );
}
