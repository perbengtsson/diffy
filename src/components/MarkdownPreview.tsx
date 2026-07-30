import { useEffect, useMemo, useState } from 'react';
import { Box, Text } from 'ink';
import {
  initHighlighter,
  parseMarkdown,
  renderNodesToString,
} from 'ink-stream-markdown';
import type { Theme } from '../theme.js';

type Props = {
  content: string | null;
  loading?: boolean;
  scrollOffset: number;
  height: number;
  width: number;
  theme: Theme;
  emptyMessage?: string;
};

let highlighterPromise: Promise<void> | null = null;

function ensureHighlighter(): Promise<void> {
  if (!highlighterPromise) {
    highlighterPromise = initHighlighter().catch(() => {
      // Highlighting is optional; plain markdown still renders.
    });
  }
  return highlighterPromise;
}

/** Render markdown to terminal lines (ANSI included) for a given content width. */
export function renderMarkdownLines(content: string, width: number): string[] {
  if (!content) return [];
  const rendered = renderNodesToString(parseMarkdown(content), { width: Math.max(20, width) });
  return rendered.length === 0 ? [] : rendered.split('\n');
}

export function MarkdownPreview({
  content,
  loading = false,
  scrollOffset,
  height,
  width,
  theme,
  emptyMessage = 'Empty markdown file',
}: Props) {
  const [hlEpoch, setHlEpoch] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void ensureHighlighter().then(() => {
      if (!cancelled) setHlEpoch((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const lines = useMemo(() => {
    void hlEpoch;
    if (loading) return ['Loading…'];
    if (content === null) return [];
    return renderMarkdownLines(content, width);
  }, [content, hlEpoch, loading, width]);

  const visible = lines.slice(scrollOffset, scrollOffset + height);
  while (visible.length < height) {
    visible.push('');
  }

  if (!loading && content === null) {
    return (
      <Box width={width} height={height}>
        <Text dimColor color={theme.dimFg}>
          {emptyMessage}
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width={width} height={height}>
      {visible.map((line, i) => (
        <Text key={scrollOffset + i}>{line.length === 0 ? ' ' : line}</Text>
      ))}
    </Box>
  );
}
