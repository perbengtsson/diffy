import { Box, Text } from 'ink';
import type { FileTreeRow } from '../files/tree.js';
import type { DiffFile } from '../git/types.js';
import type { Theme } from '../theme.js';

type Props = {
  rows: FileTreeRow[];
  selectedRowIndex: number;
  scrollOffset: number;
  height: number;
  width: number;
  focused: boolean;
  theme: Theme;
  fileCount: number;
};

function statusBadge(status: DiffFile['status']): string {
  switch (status) {
    case 'added':
      return 'A';
    case 'deleted':
      return 'D';
    case 'renamed':
      return 'R';
    case 'untracked':
      return '?';
    default:
      return 'M';
  }
}

function truncateName(name: string, maxLen: number): string {
  if (name.length <= maxLen) return name;
  if (maxLen <= 3) return name.slice(0, maxLen);
  return '…' + name.slice(name.length - (maxLen - 1));
}

export function FileList({
  rows,
  selectedRowIndex,
  scrollOffset,
  height,
  width,
  focused,
  theme,
  fileCount,
}: Props) {
  const innerHeight = Math.max(1, height - 1);
  const visible = rows.slice(scrollOffset, scrollOffset + innerHeight);

  return (
    <Box
      flexDirection="column"
      width={width}
      height={height}
      borderStyle="single"
      borderTop={false}
      borderBottom={false}
      borderLeft={false}
      borderRight
      borderColor={theme.borderFg}
    >
      <Box paddingX={1}>
        <Text bold color={focused ? theme.selectedBg : theme.defaultFg}>
          Files ({fileCount})
        </Text>
      </Box>
      {rows.length === 0 ? (
        <Box paddingX={1}>
          <Text bold color={theme.dimFg}>No changes</Text>
        </Box>
      ) : (
        visible.map((row, i) => {
          const index = scrollOffset + i;
          const selected = index === selectedRowIndex;
          const indent = '  '.repeat(row.depth);
          const prefix =
            row.node.kind === 'dir'
              ? row.isExpanded
                ? '▾ '
                : '▸ '
              : selected
                ? '● '
                : '  ';
          const label =
            row.node.kind === 'dir' ? `${row.node.name}/` : row.node.name;
          const labelWidth = Math.max(
            4,
            width - indent.length - prefix.length - 6,
          );

          return (
            <Box key={`${row.node.path}:${index}`} paddingX={1}>
              <Text
                bold
                backgroundColor={selected ? theme.selectedBg : undefined}
                color={selected ? theme.selectedFg : theme.defaultFg}
              >
                {indent}
                {prefix}
                {row.node.kind === 'file' && row.node.file ? (
                  <>
                    <Text bold color={selected ? theme.selectedFg : theme.hunkHeaderFg}>
                      {statusBadge(row.node.file.status)}
                    </Text>{' '}
                    {truncateName(label, labelWidth)}
                    {(row.node.file.additions > 0 || row.node.file.deletions > 0) && (
                      <Text bold color={theme.dimFg}>
                        {' '}
                        {row.node.file.additions > 0 && (
                          <Text bold color="green">+{row.node.file.additions}</Text>
                        )}
                        {row.node.file.deletions > 0 && (
                          <Text bold color="red">-{row.node.file.deletions}</Text>
                        )}
                      </Text>
                    )}
                  </>
                ) : (
                  truncateName(label, labelWidth)
                )}
              </Text>
            </Box>
          );
        })
      )}
    </Box>
  );
}
