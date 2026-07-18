import type { ReactNode } from 'react';
import { Box, Text } from 'ink';
import type { LineHighlightCache } from '../highlight/cache.js';
import { tokensForLine } from '../highlight/cache.js';
import type { HighlightToken } from '../highlight/tokens.js';
import { truncateTokens } from '../highlight/tokens.js';
import type { DisplayLine, DisplayLineKind } from '../diff/types.js';
import type { Theme } from '../theme.js';
import { SCROLLBAR_WIDTH, needsScrollBar } from './scrollBar.js';
import { DiffScrollBar } from './DiffScrollBar.js';
import { displayLineCommentKey } from '../review/store.js';

type Props = {
  lines: DisplayLine[];
  scrollOffset: number;
  cursorLine: number;
  height: number;
  width: number;
  focused: boolean;
  theme: Theme;
  highlightCache?: LineHighlightCache;
  searchQuery?: string;
  searchMatchLines?: ReadonlySet<number>;
  activeSearchLine?: number;
  /** Keys as `side:line` (e.g. `new:42`) for gutter comment markers. */
  commentedKeys?: ReadonlySet<string>;
  emptyMessage?: string;
};

/** old(4) + new(4) + separator(1) */
const GUTTER_WIDTH = 9;
type SearchHighlightStyle = { bg: string; fg: string };

const SEARCH_MATCH: SearchHighlightStyle = { bg: 'yellow', fg: 'black' };
const SEARCH_ACTIVE: SearchHighlightStyle = { bg: 'yellow', fg: 'black' };

function searchStyle(highlight?: 'match' | 'active'): SearchHighlightStyle | undefined {
  if (highlight === 'active') return SEARCH_ACTIVE;
  if (highlight === 'match') return SEARCH_MATCH;
  return undefined;
}

type RenderToken = HighlightToken & { backgroundColor?: string };

function formatLineNo(n: number | undefined, width: number): string {
  if (n === undefined) return ' '.repeat(width);
  return String(n).padStart(width);
}

function isUneditedLine(kind: DisplayLineKind): boolean {
  return kind === 'context';
}

function diffBackground(line: DisplayLine, theme: Theme): string | undefined {
  if (line.kind === 'add') return theme.addedBg;
  if (line.kind === 'delete') return theme.removedBg;
  return undefined;
}

function usedContentWidth(
  line: DisplayLine,
  highlightCache: LineHighlightCache | undefined,
  contentWidth: number,
): number {
  const tokens = tokensForLine(line, highlightCache);
  if (tokens) {
    let remaining = contentWidth;
    let used = 0;
    for (const token of tokens) {
      if (remaining <= 0) break;
      if (token.text.length <= remaining) {
        used += token.text.length;
        remaining -= token.text.length;
        continue;
      }
      return remaining === 1 ? used + 1 : used + remaining;
    }
    return used;
  }

  const text = line.content;
  return text.length > contentWidth ? contentWidth : text.length;
}

function renderLinePadding(
  usedWidth: number,
  contentWidth: number,
  backgroundColor?: string,
) {
  if (!backgroundColor || usedWidth >= contentWidth) return null;
  return (
    <Text backgroundColor={backgroundColor}>
      {' '.repeat(contentWidth - usedWidth)}
    </Text>
  );
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

function findMatchRanges(
  text: string,
  query: string,
): { start: number; end: number }[] {
  if (!query) return [];
  const lower = text.toLowerCase();
  const needle = query.toLowerCase();
  const ranges: { start: number; end: number }[] = [];
  let pos = 0;
  while (pos < lower.length) {
    const idx = lower.indexOf(needle, pos);
    if (idx === -1) break;
    ranges.push({ start: idx, end: idx + needle.length });
    pos = idx + needle.length;
  }
  return ranges;
}

function mergeRenderTokens(tokens: RenderToken[]): RenderToken[] {
  const merged: RenderToken[] = [];
  for (const token of tokens) {
    const last = merged[merged.length - 1];
    if (
      last &&
      last.color === token.color &&
      last.backgroundColor === token.backgroundColor
    ) {
      last.text += token.text;
    } else {
      merged.push({ ...token });
    }
  }
  return merged;
}

function applySearchHighlight(
  tokens: HighlightToken[],
  query: string,
  style: SearchHighlightStyle,
  maxWidth: number,
): RenderToken[] {
  const truncated = truncateTokens(tokens, maxWidth);
  if (!query) return truncated;

  const styled: RenderToken[] = [];
  for (const token of truncated) {
    for (const ch of token.text) {
      styled.push({ text: ch, color: token.color });
    }
  }

  const text = styled.map((t) => t.text).join('');
  for (const { start, end } of findMatchRanges(text, query)) {
    for (let i = start; i < end; i++) {
      styled[i]!.backgroundColor = style.bg;
      styled[i]!.color = style.fg;
    }
  }

  return mergeRenderTokens(styled);
}

function renderGutter(
  line: DisplayLine,
  theme: Theme,
  bold: boolean,
  highlight?: SearchHighlightStyle,
  hasComment?: boolean,
) {
  const backgroundColor = highlight?.bg;
  return (
    <>
      <Text
        bold={bold}
        color={highlight ? highlight.fg : gutterColor(line, 'old', theme)}
        backgroundColor={backgroundColor}
      >
        {formatLineNo(line.oldLineNo, 4)}
      </Text>
      <Text
        bold={bold}
        color={highlight ? highlight.fg : gutterColor(line, 'new', theme)}
        backgroundColor={backgroundColor}
      >
        {formatLineNo(line.newLineNo, 4)}
      </Text>
      <Text
        backgroundColor={backgroundColor}
        color={hasComment ? theme.hunkHeaderFg : undefined}
        dimColor={!hasComment}
      >
        {hasComment ? '●' : ' '}
      </Text>
    </>
  );
}

function renderTokens(
  tokens: RenderToken[],
  opts: {
    bold?: boolean;
    backgroundColor?: string;
    defaultColor?: string;
    dimColor?: boolean;
  },
) {
  return tokens.map((token, i) => (
    <Text
      key={i}
      bold={opts.bold}
      color={token.color ?? opts.defaultColor}
      backgroundColor={token.backgroundColor ?? opts.backgroundColor}
      dimColor={opts.dimColor}
    >
      {token.text}
    </Text>
  ));
}

function renderTextWithSearch(
  text: string,
  query: string,
  style: SearchHighlightStyle | undefined,
  props: {
    bold?: boolean;
    color?: string;
    backgroundColor?: string;
    dimColor?: boolean;
  },
) {
  if (!query || !style) {
    return <Text {...props}>{text}</Text>;
  }

  const ranges = findMatchRanges(text, query);
  if (ranges.length === 0) {
    return <Text {...props}>{text}</Text>;
  }

  const parts: ReactNode[] = [];
  let last = 0;
  for (const { start, end } of ranges) {
    if (last < start) {
      parts.push(
        <Text key={`pre-${last}`} {...props}>
          {text.slice(last, start)}
        </Text>,
      );
    }
    parts.push(
      <Text
        key={`match-${start}`}
        bold={props.bold}
        color={style.fg}
        backgroundColor={style.bg}
      >
        {text.slice(start, end)}
      </Text>,
    );
    last = end;
  }
  if (last < text.length) {
    parts.push(
      <Text key={`post-${last}`} {...props}>
        {text.slice(last)}
      </Text>,
    );
  }
  return <>{parts}</>;
}

function renderLineContent(
  line: DisplayLine,
  theme: Theme,
  contentWidth: number,
  highlightCache: LineHighlightCache | undefined,
  searchQuery: string | undefined,
  searchHighlight?: 'match' | 'active',
) {
  const tokens = tokensForLine(line, highlightCache);
  const bold = !isUneditedLine(line.kind);
  const highlight = searchStyle(searchHighlight);
  const diffBg = diffBackground(line, theme);
  const usedWidth = usedContentWidth(line, highlightCache, contentWidth);

  if (tokens) {
    switch (line.kind) {
      case 'add':
        return (
          <>
            {renderTokens(
              highlight && searchQuery
                ? applySearchHighlight(tokens, searchQuery, highlight, contentWidth)
                : truncateTokens(tokens, contentWidth),
              { bold, backgroundColor: diffBg },
            )}
            {renderLinePadding(usedWidth, contentWidth, diffBg)}
          </>
        );
      case 'delete':
        return (
          <>
            {renderTokens(
              highlight && searchQuery
                ? applySearchHighlight(tokens, searchQuery, highlight, contentWidth)
                : truncateTokens(tokens, contentWidth),
              { bold, backgroundColor: diffBg },
            )}
            {renderLinePadding(usedWidth, contentWidth, diffBg)}
          </>
        );
      case 'context':
        return renderTokens(
          highlight && searchQuery
            ? applySearchHighlight(tokens, searchQuery, highlight, contentWidth)
            : truncateTokens(tokens, contentWidth),
          { defaultColor: theme.contextFg },
        );
    }
  }

  const text = line.content.length > contentWidth
    ? line.content.slice(0, contentWidth - 1) + '…'
    : line.content;

  switch (line.kind) {
    case 'add':
      return (
        <>
          {renderTextWithSearch(text, searchQuery ?? '', highlight, {
            bold,
            backgroundColor: diffBg,
          })}
          {renderLinePadding(usedWidth, contentWidth, diffBg)}
        </>
      );
    case 'delete':
      return (
        <>
          {renderTextWithSearch(text, searchQuery ?? '', highlight, {
            bold,
            backgroundColor: diffBg,
          })}
          {renderLinePadding(usedWidth, contentWidth, diffBg)}
        </>
      );
    case 'hunk-header':
      return (
        <Text bold color={theme.hunkHeaderFg}>
          {line.content}
        </Text>
      );
    case 'file-header':
      return (
        <Text bold color={theme.dimFg}>
          {line.content}
        </Text>
      );
    case 'binary':
      return (
        <Text bold color={theme.dimFg}>
          {line.content}
        </Text>
      );
    default:
      return renderTextWithSearch(text, searchQuery ?? '', highlight, {
        color: theme.contextFg,
      });
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
  searchQuery,
  searchMatchLines,
  activeSearchLine,
  commentedKeys,
  emptyMessage = 'Select a file to view its diff',
}: Props) {
  const innerHeight = Math.max(1, height);
  const showScrollBar = needsScrollBar(lines.length, innerHeight);
  const contentWidth = Math.max(
    10,
    width - GUTTER_WIDTH - (showScrollBar ? SCROLLBAR_WIDTH : 0),
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
              const isSearchMatch = searchMatchLines?.has(absoluteIndex) ?? false;
              const isActiveSearch = activeSearchLine === absoluteIndex;
              const searchHighlight = isActiveSearch
                ? 'active'
                : isSearchMatch
                  ? 'match'
                  : undefined;
              const highlightStyle = searchStyle(searchHighlight);
              const bold = !isUneditedLine(line.kind);
              const commentKey = displayLineCommentKey(line);
              const hasComment =
                commentKey !== null && (commentedKeys?.has(commentKey) ?? false);
              return (
                <Box key={absoluteIndex}>
                  <Text
                    bold={bold}
                    backgroundColor={
                      atCursor && searchHighlight === undefined
                        ? theme.selectedBg
                        : undefined
                    }
                    color={
                      atCursor && searchHighlight === undefined
                        ? theme.selectedFg
                        : undefined
                    }
                  >
                    {renderGutter(line, theme, bold, highlightStyle, hasComment)}
                    {renderLineContent(
                      line,
                      theme,
                      contentWidth,
                      highlightCache,
                      searchQuery,
                      searchHighlight,
                    )}
                  </Text>
                </Box>
              );
            })}
          </Box>
          {showScrollBar && (
            <DiffScrollBar
              lines={lines}
              scrollOffset={scrollOffset}
              viewportHeight={innerHeight}
              height={innerHeight}
              theme={theme}
            />
          )}
        </Box>
      )}
    </Box>
  );
}
