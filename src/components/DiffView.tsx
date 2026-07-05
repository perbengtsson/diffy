import { Box, Text } from 'ink';
import type { DisplayLine } from '../diff/types.js';
import type { Theme } from '../theme.js';

type Props = {
  lines: DisplayLine[];
  scrollOffset: number;
  cursorLine: number;
  height: number;
  width: number;
  focused: boolean;
  theme: Theme;
  filePath: string;
  emptyMessage?: string;
};

function formatLineNo(n: number | undefined, width: number): string {
  if (n === undefined) return ' '.repeat(width);
  return String(n).padStart(width);
}

function renderLineContent(line: DisplayLine, theme: Theme, contentWidth: number) {
  const text = line.content.length > contentWidth
    ? line.content.slice(0, contentWidth - 1) + '…'
    : line.content;

  switch (line.kind) {
    case 'add':
      return (
        <Text bold backgroundColor={theme.addedBg} color={theme.addedFg}>
          +{text}
        </Text>
      );
    case 'delete':
      return (
        <Text bold backgroundColor={theme.removedBg} color={theme.removedFg}>
          -{text}
        </Text>
      );
    case 'expanded-context':
      return (
        <Text bold color={theme.expandedContextFg} dimColor>
          {' '}{text}
        </Text>
      );
    case 'hunk-header':
      return <Text bold color={theme.hunkHeaderFg}>{line.content}</Text>;
    case 'file-header':
      return <Text bold color={theme.dimFg}>{line.content}</Text>;
    case 'binary':
      return <Text bold color={theme.dimFg}>{line.content}</Text>;
    default:
      return (
        <Text bold color={theme.contextFg} dimColor={line.kind === 'context'}>
          {' '}{text}
        </Text>
      );
  }
}

export function DiffView({
  lines,
  scrollOffset,
  cursorLine,
  height,
  width,
  focused,
  theme,
  filePath,
  emptyMessage = 'Select a file to view its diff',
}: Props) {
  const innerHeight = Math.max(1, height - 1);
  const gutterWidth = 8;
  const contentWidth = Math.max(10, width - gutterWidth - 4);
  const visible = lines.slice(scrollOffset, scrollOffset + innerHeight);

  return (
    <Box flexDirection="column" width={width} height={height} flexGrow={1}>
      <Box paddingX={1}>
        <Text bold color={focused ? theme.selectedBg : theme.defaultFg}>
          Diff
        </Text>
        <Text bold color={theme.dimFg}> — {filePath || '(none)'}</Text>
      </Box>
      {lines.length === 0 ? (
        <Box paddingX={1}>
          <Text bold color={theme.dimFg}>{emptyMessage}</Text>
        </Box>
      ) : (
        visible.map((line, i) => {
          const absoluteIndex = scrollOffset + i;
          const atCursor = focused && absoluteIndex === cursorLine;
          return (
            <Box key={absoluteIndex} paddingX={1}>
              <Text
                bold
                backgroundColor={atCursor ? theme.borderFg : undefined}
                color={atCursor ? theme.selectedFg : undefined}
              >
                <Text bold color={theme.dimFg}>
                  {formatLineNo(line.oldLineNo, 4)}
                  {formatLineNo(line.newLineNo, 4)}{' '}
                </Text>
                {renderLineContent(line, theme, contentWidth)}
              </Text>
            </Box>
          );
        })
      )}
    </Box>
  );
}
