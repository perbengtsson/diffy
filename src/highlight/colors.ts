const CLASS_COLORS: Record<string, string> = {
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

export function classToColor(classes: string[]): string | undefined {
  for (let i = classes.length - 1; i >= 0; i--) {
    const color = CLASS_COLORS[classes[i]!];
    if (color) return color;
  }
  return undefined;
}
