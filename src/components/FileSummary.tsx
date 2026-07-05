import { Box, Text } from 'ink';
import type { ChangeSummary } from '../files/summary.js';
import type { Theme } from '../theme.js';

type Props = {
  summary: ChangeSummary;
  width: number;
  theme: Theme;
  maxTypeRows?: number;
};

function padLabel(label: string, width: number): string {
  if (label.length >= width) return label.slice(0, width);
  return label.padEnd(width);
}

export function fileSummaryHeight(
  summary: ChangeSummary,
  maxTypeRows = 5,
): number {
  if (summary.fileCount === 0) return 3;
  return 2 + Math.min(summary.byType.length, maxTypeRows);
}

export function FileSummary({
  summary,
  width,
  theme,
  maxTypeRows = 5,
}: Props) {
  const labelWidth = Math.min(6, Math.max(4, Math.floor(width * 0.22)));
  const visibleTypes = summary.byType.slice(0, maxTypeRows);
  const hiddenTypeCount = summary.byType.length - visibleTypes.length;

  return (
    <Box
      flexDirection="column"
      width={width}
      borderStyle="single"
      borderTop
      borderBottom={false}
      borderLeft={false}
      borderRight
      borderColor={theme.borderFg}
      paddingX={1}
    >
      <Text bold color={theme.defaultFg}>Summary</Text>
      {summary.fileCount === 0 ? (
        <Text color={theme.dimFg} dimColor>No changes</Text>
      ) : (
        <>
          <Text color={theme.dimFg}>
            <Text bold color="green">+{summary.totalAdditions}</Text>
            {' '}
            <Text bold color="red">-{summary.totalDeletions}</Text>
            {' '}
            <Text dimColor>({summary.fileCount} files)</Text>
          </Text>
          {visibleTypes.map((type) => (
            <Text key={type.label} color={theme.dimFg}>
              {padLabel(type.label, labelWidth)}
              <Text dimColor> {type.fileCount} </Text>
              {type.additions > 0 && (
                <Text bold color="green">+{type.additions}</Text>
              )}
              {type.additions > 0 && type.deletions > 0 && ' '}
              {type.deletions > 0 && (
                <Text bold color="red">-{type.deletions}</Text>
              )}
              {type.additions === 0 && type.deletions === 0 && (
                <Text dimColor>0</Text>
              )}
            </Text>
          ))}
          {hiddenTypeCount > 0 && (
            <Text color={theme.dimFg} dimColor>
              +{hiddenTypeCount} more
            </Text>
          )}
        </>
      )}
    </Box>
  );
}
