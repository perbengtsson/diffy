/** Cursor/agent paste format: `@path` or `@path:line`. */
export function formatAgentFileRef(path: string, line?: number): string {
  if (line !== undefined) return `@${path}:${line}`;
  return `@${path}`;
}
