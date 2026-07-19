export type HighlightSchema = {
  id: string;
  label: string;
  blurb: string;
  colors: Record<string, string>;
};

const DEFAULT_COLORS: Record<string, string> = {
  'hljs-keyword': 'magenta',
  'hljs-built_in': 'cyan',
  'hljs-type': 'cyan',
  'hljs-literal': 'cyan',
  'hljs-number': 'cyan',
  'hljs-string': 'yellow',
  'hljs-regexp': 'yellow',
  'hljs-comment': 'gray',
  'hljs-doctag': 'gray',
  'hljs-meta': 'gray',
  'hljs-title': 'blue',
  'hljs-title.function_': 'blue',
  'hljs-function': 'blue',
  'hljs-attr': 'cyan',
  'hljs-attribute': 'cyan',
  'hljs-variable': 'white',
  'hljs-name': 'red',
  'hljs-tag': 'red',
  'hljs-selector-tag': 'red',
  'hljs-selector-class': 'yellow',
  'hljs-selector-id': 'yellow',
  'hljs-property': 'blue',
  'hljs-symbol': 'magenta',
  'hljs-addition': 'green',
  'hljs-deletion': 'red',
};

/** Named syntax color maps — pick via `h` in the app. */
export const HIGHLIGHT_SCHEMAS: HighlightSchema[] = [
  {
    id: 'default',
    label: 'Default',
    blurb: 'Original rainbow tokens',
    colors: DEFAULT_COLORS,
  },
  {
    id: 'monokai',
    label: 'Monokai',
    blurb: 'Pink keywords, green names, warm strings',
    colors: {
      ...DEFAULT_COLORS,
      'hljs-keyword': 'ansi256(197)',
      'hljs-built_in': 'ansi256(81)',
      'hljs-type': 'ansi256(81)',
      'hljs-literal': 'ansi256(141)',
      'hljs-number': 'ansi256(141)',
      'hljs-string': 'ansi256(186)',
      'hljs-regexp': 'ansi256(186)',
      'hljs-comment': 'ansi256(59)',
      'hljs-doctag': 'ansi256(59)',
      'hljs-meta': 'ansi256(59)',
      'hljs-title': 'ansi256(148)',
      'hljs-title.function_': 'ansi256(148)',
      'hljs-function': 'ansi256(148)',
      'hljs-attr': 'ansi256(81)',
      'hljs-attribute': 'ansi256(81)',
      'hljs-variable': 'ansi256(255)',
      'hljs-name': 'ansi256(197)',
      'hljs-tag': 'ansi256(197)',
      'hljs-selector-tag': 'ansi256(197)',
      'hljs-selector-class': 'ansi256(148)',
      'hljs-selector-id': 'ansi256(208)',
      'hljs-property': 'ansi256(81)',
      'hljs-symbol': 'ansi256(197)',
    },
  },
  {
    id: 'github',
    label: 'GitHub',
    blurb: 'Closer to GitHub token hues',
    colors: {
      ...DEFAULT_COLORS,
      'hljs-keyword': 'ansi256(215)',
      'hljs-built_in': 'ansi256(75)',
      'hljs-type': 'ansi256(75)',
      'hljs-literal': 'ansi256(75)',
      'hljs-number': 'ansi256(75)',
      'hljs-string': 'ansi256(114)',
      'hljs-regexp': 'ansi256(114)',
      'hljs-comment': 'ansi256(245)',
      'hljs-doctag': 'ansi256(245)',
      'hljs-meta': 'ansi256(245)',
      'hljs-title': 'ansi256(141)',
      'hljs-title.function_': 'ansi256(141)',
      'hljs-function': 'ansi256(141)',
      'hljs-attr': 'ansi256(75)',
      'hljs-attribute': 'ansi256(75)',
      'hljs-variable': 'ansi256(252)',
      'hljs-name': 'ansi256(167)',
      'hljs-tag': 'ansi256(167)',
      'hljs-selector-tag': 'ansi256(167)',
      'hljs-selector-class': 'ansi256(114)',
      'hljs-selector-id': 'ansi256(114)',
      'hljs-property': 'ansi256(75)',
      'hljs-symbol': 'ansi256(215)',
    },
  },
  {
    id: 'muted',
    label: 'Muted',
    blurb: 'Low-chroma — less rainbow noise',
    colors: {
      ...DEFAULT_COLORS,
      'hljs-keyword': 'ansi256(176)',
      'hljs-built_in': 'ansi256(109)',
      'hljs-type': 'ansi256(109)',
      'hljs-literal': 'ansi256(109)',
      'hljs-number': 'ansi256(109)',
      'hljs-string': 'ansi256(144)',
      'hljs-regexp': 'ansi256(144)',
      'hljs-comment': 'ansi256(243)',
      'hljs-doctag': 'ansi256(243)',
      'hljs-meta': 'ansi256(243)',
      'hljs-title': 'ansi256(110)',
      'hljs-title.function_': 'ansi256(110)',
      'hljs-function': 'ansi256(110)',
      'hljs-attr': 'ansi256(109)',
      'hljs-attribute': 'ansi256(109)',
      'hljs-variable': 'ansi256(250)',
      'hljs-name': 'ansi256(174)',
      'hljs-tag': 'ansi256(174)',
      'hljs-selector-tag': 'ansi256(174)',
      'hljs-selector-class': 'ansi256(144)',
      'hljs-selector-id': 'ansi256(144)',
      'hljs-property': 'ansi256(110)',
      'hljs-symbol': 'ansi256(176)',
    },
  },
  {
    id: 'dracula',
    label: 'Dracula',
    blurb: 'Purple keywords, pink strings, cyan names',
    colors: {
      ...DEFAULT_COLORS,
      'hljs-keyword': 'ansi256(141)',
      'hljs-built_in': 'ansi256(117)',
      'hljs-type': 'ansi256(117)',
      'hljs-literal': 'ansi256(117)',
      'hljs-number': 'ansi256(183)',
      'hljs-string': 'ansi256(228)',
      'hljs-regexp': 'ansi256(228)',
      'hljs-comment': 'ansi256(61)',
      'hljs-doctag': 'ansi256(61)',
      'hljs-meta': 'ansi256(61)',
      'hljs-title': 'ansi256(84)',
      'hljs-title.function_': 'ansi256(84)',
      'hljs-function': 'ansi256(84)',
      'hljs-attr': 'ansi256(117)',
      'hljs-attribute': 'ansi256(117)',
      'hljs-variable': 'ansi256(255)',
      'hljs-name': 'ansi256(212)',
      'hljs-tag': 'ansi256(212)',
      'hljs-selector-tag': 'ansi256(212)',
      'hljs-selector-class': 'ansi256(84)',
      'hljs-selector-id': 'ansi256(228)',
      'hljs-property': 'ansi256(117)',
      'hljs-symbol': 'ansi256(141)',
    },
  },
];

export const DEFAULT_HIGHLIGHT_SCHEMA_ID = 'default';

const KNOWN_CLASSES = new Set(Object.keys(DEFAULT_COLORS));

export function findHighlightSchema(id: string): HighlightSchema {
  return (
    HIGHLIGHT_SCHEMAS.find((s) => s.id === id) ??
    HIGHLIGHT_SCHEMAS.find((s) => s.id === DEFAULT_HIGHLIGHT_SCHEMA_ID) ??
    HIGHLIGHT_SCHEMAS[0]!
  );
}

/** Most specific known hljs class from a token's class list (innermost wins). */
export function matchHighlightClass(classes: string[]): string | undefined {
  for (let i = classes.length - 1; i >= 0; i--) {
    const cls = classes[i]!;
    if (KNOWN_CLASSES.has(cls)) return cls;
  }
  return undefined;
}

export function classToColor(
  classes: string[],
  schemaId: string = DEFAULT_HIGHLIGHT_SCHEMA_ID,
): string | undefined {
  const matched = matchHighlightClass(classes);
  if (!matched) return undefined;
  return findHighlightSchema(schemaId).colors[matched];
}

export function colorForClass(
  className: string | undefined,
  schemaId: string = DEFAULT_HIGHLIGHT_SCHEMA_ID,
): string | undefined {
  if (!className) return undefined;
  return findHighlightSchema(schemaId).colors[className];
}
