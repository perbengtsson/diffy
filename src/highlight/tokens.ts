import { common, createLowlight } from 'lowlight';
import { matchHighlightClass } from './colors.js';

const lowlight = createLowlight(common);

export type HighlightToken = {
  text: string;
  /** hljs class for schema color lookup at render time */
  className?: string;
};

type HastNode = {
  type: string;
  value?: string;
  children?: HastNode[];
  properties?: { className?: string[] };
};

function appendToken(
  lineTokens: HighlightToken[][],
  lineIndex: number,
  text: string,
  classes: string[],
): number {
  const className = matchHighlightClass(classes);
  const parts = text.split('\n');
  let current = lineIndex;

  for (let i = 0; i < parts.length; i++) {
    if (i > 0) current++;
    const part = parts[i] ?? '';
    if (part.length === 0) continue;

    while (lineTokens.length <= current) {
      lineTokens.push([]);
    }

    const line = lineTokens[current]!;
    const last = line[line.length - 1];
    if (last && last.className === className) {
      last.text += part;
    } else {
      line.push(className ? { text: part, className } : { text: part });
    }
  }

  return current;
}

function walkTree(
  node: HastNode,
  lineTokens: HighlightToken[][],
  lineIndex: number,
  classes: string[],
): number {
  if (node.type === 'text') {
    return appendToken(lineTokens, lineIndex, node.value ?? '', classes);
  }

  if (node.type === 'root' || node.type === 'element') {
    const nodeClasses = node.properties?.className ?? [];
    const merged = node.type === 'element' ? [...classes, ...nodeClasses] : classes;
    let current = lineIndex;
    for (const child of node.children ?? []) {
      current = walkTree(child, lineTokens, current, merged);
    }
    return current;
  }

  return lineIndex;
}

export function highlightFileLines(
  lines: string[],
  language: string | null,
): Map<number, HighlightToken[]> {
  const result = new Map<number, HighlightToken[]>();
  if (lines.length === 0) return result;

  const plain = () => {
    for (let i = 0; i < lines.length; i++) {
      result.set(i + 1, [{ text: lines[i] ?? '' }]);
    }
    return result;
  };

  if (!language || !lowlight.registered(language)) {
    return plain();
  }

  const source = lines.join('\n');
  let tree: HastNode;
  try {
    tree = lowlight.highlight(language, source) as HastNode;
  } catch {
    return plain();
  }

  const lineTokens: HighlightToken[][] = [];
  walkTree(tree, lineTokens, 0, []);

  for (let i = 0; i < lines.length; i++) {
    const tokens = lineTokens[i];
    result.set(i + 1, tokens?.length ? tokens : [{ text: lines[i] ?? '' }]);
  }

  return result;
}

export function truncateTokens(
  tokens: HighlightToken[],
  maxWidth: number,
): HighlightToken[] {
  if (maxWidth <= 0) return [{ text: '…' }];

  let remaining = maxWidth;
  const out: HighlightToken[] = [];

  for (const token of tokens) {
    if (remaining <= 0) break;
    if (token.text.length <= remaining) {
      out.push(token);
      remaining -= token.text.length;
      continue;
    }
    if (remaining === 1) {
      out.push({ text: '…', className: token.className });
    } else {
      out.push({
        text: token.text.slice(0, remaining - 1) + '…',
        className: token.className,
      });
    }
    remaining = 0;
  }

  return out;
}
