import { basename } from 'node:path';
import chalk from 'chalk';
import type { ReviewComment, ReviewSession } from './types.js';

function groupByPath(comments: ReviewComment[]): Map<string, ReviewComment[]> {
  const map = new Map<string, ReviewComment[]>();
  for (const c of comments) {
    const list = map.get(c.path) ?? [];
    list.push(c);
    map.set(c.path, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.line - b.line || a.side.localeCompare(b.side));
  }
  return map;
}

/** CLI command to reopen this review cache file. */
export function resumeCommand(reviewPath: string): string {
  const name = basename(reviewPath).replace(/\.json$/i, '');
  return `diffy --resume ${name}`;
}

function commentHeading(c: ReviewComment): string {
  if (c.side === 'context') {
    if (c.otherLine !== undefined) {
      return `### L${c.line} (context; old L${c.otherLine})`;
    }
    return `### L${c.line} (context)`;
  }
  return `### L${c.line} (${c.side})`;
}

const LEGEND =
  'Line anchors: `(old)` = deleted/pre-change, `(new)` = added/post-change, `(context)` = unchanged line in both sides.';

/** Plain markdown review (no ANSI). */
export function compileReview(session: ReviewSession): string {
  if (session.comments.length === 0) return '';

  const lines: string[] = [
    `# Diffy review — ${session.branch} — ${session.date}`,
    '',
    LEGEND,
    '',
  ];

  const byPath = groupByPath(session.comments);
  for (const [path, comments] of byPath) {
    lines.push(`## ${path}`, '');
    for (const c of comments) {
      lines.push(commentHeading(c));
      if (c.snippet) {
        lines.push(`> ${c.snippet}`);
      }
      lines.push(c.body, '');
    }
  }

  return lines.join('\n').trimEnd() + '\n';
}

/** Colored review for terminal quit output (uniform cyan for agent copy-paste). */
export function formatReviewTerminal(session: ReviewSession): string {
  const plain = compileReview(session);
  if (!plain) return '';
  return chalk.cyan(plain);
}
