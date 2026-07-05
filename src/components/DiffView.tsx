import { Box, Text } from 'ink';
import type { LineHighlightCache } from '../highlight/cache.js';
import { tokensForLine } from '../highlight/cache.js';
import type { HighlightToken } from '../highlight/tokens.js';
import { truncateTokens } from '../highlight/tokens.js';
import type { DisplayLine, DisplayLineKind } from '../diff/types.js';
import type { Theme } from '../theme.js';
import { DiffScrollBar } from './DiffScrollBar.js';

type Props = {
  lines: DisplayLine[];
  scrollOffset: number;
  cursorLine: number;
  height: number;
  width: number;
  focused: boolean;
  theme: Theme;
  highlightCache?: LineHighlightCache;
  emptyMessage?: string;
};

const SCROLLBAR_WIDTH = 1;
const GUTTER_WIDTH = 8;

function formatLineNo(n: number | undefined, width: number): string {
  if (n === undefined) return ' '.repeat(width);
  return String(n).padStart(width);
}

function isUneditedLine(kind: DisplayLineKind): boolean {
  return kind === 'context' || kind === 'expanded-context';
}

function gutterColor(
  line: DisplayLine,
  side: 'old' | 'new',
  theme: Theme,
): string {
  if (side === 'old' && line.kind === 'delete' && line.oldLineNo !== undefined) {
    return theme.removedFg;
  }
  if (side === 'new' && line.kind === 'add' && line.newLineNo !== undefined) {
    return theme.addedFg;
  }
  return theme.dimFg;
}

function renderGutter(line: DisplayLine, theme: Theme, bold: boolean) {
  return (
    <>
      <Text bold={bold} color={gutterColor(line, 'old', theme)}>
        {formatLineNo(line.oldLineNo, 4)}
      </Text>
      <Text bold={bold} color={gutterColor(line, 'new', theme)}>
        {formatLineNo(line.newLineNo, 4)}
      </Text>
      {' '}
    </>
  );
}

function renderTokens(
  tokens: HighlightToken[],
  opts: {
    bold?: boolean;
    backgroundColor?: string;
    defaultColor?: string;
    dimColor?: boolean;
    contentWidth: number;
  },
) {
  const truncated = truncateTokens(tokens, opts.contentWidth);
  return truncated.map((token, i) => (
    <Text
      key={i}
      bold={opts.bold}
      color={token.color ?? opts.defaultColor}
      backgroundColor={opts.backgroundColor}
      dimColor={opts.dimColor}
    >
      {token.text}
    </Text>
  ));
}

function renderLineContent(
  line: DisplayLine,
  theme: Theme,
  contentWidth: number,
  highlightCache: LineHighlightCache | undefined,
) {
  const tokens = tokensForLine(line, highlightCache);
  const bold = !isUneditedLine(line.kind);

  if (tokens) {
    switch (line.kind) {
      case 'add':
        return renderTokens(tokens, {
          bold,
          backgroundColor: theme.addedBg,
          contentWidth,
        });
      case 'delete':
        return renderTokens(tokens, {
          bold,
          backgroundColor: theme.removedBg,
          contentWidth,
        });
      case 'expanded-context':
        return renderTokens(tokens, {
          defaultColor: theme.expandedContextFg,
          dimColor: true,
          contentWidth,
        });
      case 'context':
        return renderTokens(tokens, {
          defaultColor: theme.contextFg,
          contentWidth,
        });
    }
  }

  const text = line.content.length > contentWidth
    ? line.content.slice(0, contentWidth - 1) + '…'
    : line.content;

  switch (line.kind) {
    case 'add':
      return (
        <Text bold backgroundColor={theme.addedBg}>
          {text}
        </Text>
      );
    case 'delete':
      return (
        <Text bold backgroundColor={theme.removedBg}>
          {text}
        </Text>
      );
    case 'expanded-context':
      return (
        <Text color={theme.expandedContextFg} dimColor>
          {text}
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
        <Text color={theme.contextFg}>
          {text}
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
  highlightCache,
  emptyMessage = 'Select a file to view its diff',
}: Props) {
  const innerHeight = Math.max(1, height);
  const contentWidth = Math.max(
    10,
    width - GUTTER_WIDTH - SCROLLBAR_WIDTH - 4,
  );
  const visible = lines.slice(scrollOffset, scrollOffset + innerHeight);

  return (
    <Box flexDirection="column" width={width} height={height} flexGrow={1}>
      {lines.length === 0 ? (
        <Box paddingX={1}>
          <Text bold color={theme.dimFg}>{emptyMessage}</Text>
        </Box>
      ) : (
        <Box flexDirection="row" height={innerHeight}>
          <Box flexDirection="column" flexGrow={1}>
            {visible.map((line, i) => {
              const absoluteIndex = scrollOffset + i;
              const atCursor = focused && absoluteIndex === cursorLine;
              const bold = !isUneditedLine(line.kind);
              return (
                <Box key={absoluteIndex} paddingX={1}>
                  <Text
                    bold={bold}
                    backgroundColor={atCursor ? theme.borderFg : undefined}
                    color={atCursor ? theme.selectedFg : undefined}
                  >
                    {renderGutter(line, theme, bold)}
                    {renderLineContent(line, theme, contentWidth, highlightCache)}
                  </Text>
                </Box>
              );
            })}
          </Box>
          <DiffScrollBar
            lines={lines}
            scrollOffset={scrollOffset}
            viewportHeight={innerHeight}
            height={innerHeight}
            theme={theme}
          />
        </Box>
      )}
    </Box>
  );
}
