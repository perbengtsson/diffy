import { Box, Text } from 'ink';
import {
  HIGHLIGHT_SCHEMAS,
  colorForClass,
  type HighlightSchema,
} from '../highlight/colors.js';
import type { Theme } from '../theme.js';

type Props = {
  selectedIndex: number;
  height: number;
  width: number;
  theme: Theme;
  activeSchemaId: string;
};

type PreviewSpan = { text: string; className?: string };

const SAMPLE: PreviewSpan[] = [
  { text: 'const', className: 'hljs-keyword' },
  { text: ' ' },
  { text: 'fn', className: 'hljs-title.function_' },
  { text: ' = ' },
  { text: '"hi"', className: 'hljs-string' },
  { text: '; ' },
  { text: '// note', className: 'hljs-comment' },
];

function SchemaPreview({
  schema,
  selected,
  active,
  theme,
  width,
}: {
  schema: HighlightSchema;
  selected: boolean;
  active: boolean;
  theme: Theme;
  width: number;
}) {
  const innerWidth = Math.max(8, width - 2);
  const marker = selected ? '❯' : ' ';
  const activeTag = active ? ' (in use)' : '';
  const title = `${marker} ${schema.label}${activeTag}`;
  const blurb = `  ${schema.blurb}`;

  let used = 0;
  const spans: PreviewSpan[] = [];
  for (const span of SAMPLE) {
    if (used >= innerWidth) break;
    const room = innerWidth - used;
    if (span.text.length <= room) {
      spans.push(span);
      used += span.text.length;
    } else {
      spans.push({ text: span.text.slice(0, room), className: span.className });
      used = innerWidth;
    }
  }
  const pad = Math.max(0, innerWidth - used);

  return (
    <Box flexDirection="column" width={width} marginBottom={1}>
      <Text
        bold={selected}
        color={selected ? theme.selectedFg : theme.defaultFg}
        backgroundColor={selected ? theme.selectedBg : undefined}
      >
        {title.length > width ? title.slice(0, Math.max(1, width - 1)) + '…' : title}
      </Text>
      <Text dimColor color={theme.dimFg}>
        {blurb.length > width ? blurb.slice(0, Math.max(1, width - 1)) + '…' : blurb}
      </Text>
      <Text>
        {'  '}
        {spans.map((span, i) => (
          <Text
            key={i}
            color={colorForClass(span.className, schema.id) ?? theme.defaultFg}
            bold
          >
            {span.text}
          </Text>
        ))}
        {pad > 0 ? ' '.repeat(pad) : ''}
      </Text>
    </Box>
  );
}

/** Each schema block: title + blurb + 1 preview row + margin ≈ 4 rows. */
const BLOCK_ROWS = 4;

export function HighlightSchemaPicker({
  selectedIndex,
  height,
  width,
  theme,
  activeSchemaId,
}: Props) {
  const header = 'Syntax · ↑↓ · Enter · Esc back';
  const listHeight = Math.max(1, height - 1);
  const blocksVisible = Math.max(1, Math.floor(listHeight / BLOCK_ROWS));

  const start = Math.max(
    0,
    Math.min(
      selectedIndex - Math.floor(blocksVisible / 2),
      HIGHLIGHT_SCHEMAS.length - blocksVisible,
    ),
  );
  const visible = HIGHLIGHT_SCHEMAS.slice(start, start + blocksVisible);

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Text bold color={theme.statusFg}>
        {header.length > width ? header.slice(0, Math.max(1, width - 1)) + '…' : header}
      </Text>
      {visible.map((schema, i) => {
        const index = start + i;
        return (
          <SchemaPreview
            key={schema.id}
            schema={schema}
            selected={index === selectedIndex}
            active={schema.id === activeSchemaId}
            theme={theme}
            width={width}
          />
        );
      })}
    </Box>
  );
}
