import { basename } from 'node:path';
import type { DisplayLine } from '../diff/types.js';

export type EditorInvocation = {
  command: string;
  args: string[];
};

/**
 * Working-tree line to open for a diff row. Prefers the new-file number;
 * falls back to the old number for pure deletions.
 */
export function workingTreeLineForEdit(line: DisplayLine | undefined): number | undefined {
  if (!line) return undefined;
  if (line.newLineNo !== undefined && line.newLineNo >= 1) return line.newLineNo;
  if (line.oldLineNo !== undefined && line.oldLineNo >= 1) return line.oldLineNo;
  return undefined;
}

/** Split an EDITOR/VISUAL value into command + fixed prefix args. */
export function parseEditorEnv(value: string): { command: string; prefixArgs: string[] } {
  const trimmed = value.trim();
  if (!trimmed) return { command: 'nano', prefixArgs: [] };
  const parts =
    trimmed.match(/(?:[^\s"]+|"[^"]*")+/g)?.map((part) => part.replace(/^"|"$/g, '')) ??
    [];
  const command = parts[0] || 'nano';
  return { command, prefixArgs: parts.slice(1) };
}

export function resolveEditorFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): { command: string; prefixArgs: string[] } {
  const raw = env.VISUAL || env.EDITOR || 'nano';
  return parseEditorEnv(raw);
}

/**
 * Build argv so common editors open `file` at `line` (1-based).
 * Defaults match `nano +<line> -l <file>` when EDITOR is unset.
 */
export function buildEditorArgs(
  command: string,
  filePath: string,
  line?: number,
  prefixArgs: string[] = [],
): string[] {
  const name = basename(command).toLowerCase();
  const lineArgs =
    line !== undefined && line >= 1 ? buildLineArgs(name, filePath, line) : [filePath];
  return [...prefixArgs, ...lineArgs];
}

function buildLineArgs(editorName: string, filePath: string, line: number): string[] {
  if (
    editorName === 'code' ||
    editorName === 'code-insiders' ||
    editorName === 'codium' ||
    editorName === 'cursor' ||
    editorName === 'cursor-agent'
  ) {
    return ['-g', `${filePath}:${line}`];
  }
  if (editorName === 'nano' || editorName === 'pico') {
    return [`+${line}`, '-l', filePath];
  }
  if (editorName === 'emacs' || editorName === 'emacsclient') {
    return [`+${line}`, filePath];
  }
  // vim, nvim, vi, helix (hx), kakoune, etc.
  return [`+${line}`, filePath];
}

export function buildEditorInvocation(
  filePath: string,
  line?: number,
  env: NodeJS.ProcessEnv = process.env,
): EditorInvocation {
  const { command, prefixArgs } = resolveEditorFromEnv(env);
  return {
    command,
    args: buildEditorArgs(command, filePath, line, prefixArgs),
  };
}
