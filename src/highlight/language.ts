const EXTENSIONS: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.mts': 'typescript',
  '.cts': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.json': 'json',
  '.jsonc': 'json',
  '.css': 'css',
  '.scss': 'scss',
  '.less': 'less',
  '.html': 'xml',
  '.htm': 'xml',
  '.xml': 'xml',
  '.svg': 'xml',
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.py': 'python',
  '.rb': 'ruby',
  '.rs': 'rust',
  '.go': 'go',
  '.java': 'java',
  '.kt': 'kotlin',
  '.swift': 'swift',
  '.c': 'c',
  '.h': 'c',
  '.cpp': 'cpp',
  '.hpp': 'cpp',
  '.cs': 'csharp',
  '.php': 'php',
  '.sql': 'sql',
  '.sh': 'bash',
  '.bash': 'bash',
  '.zsh': 'bash',
  '.lua': 'lua',
  '.r': 'r',
  '.toml': 'ini',
  '.ini': 'ini',
  '.graphql': 'graphql',
  '.gql': 'graphql',
  '.wasm': 'wasm',
  '.makefile': 'makefile',
};

const BASENAMES: Record<string, string> = {
  makefile: 'makefile',
  gnumakefile: 'makefile',
};

export function languageFromPath(filePath: string): string | null {
  const base = filePath.split('/').pop()?.toLowerCase() ?? '';
  const dot = base.lastIndexOf('.');
  if (dot > 0) {
    const ext = base.slice(dot);
    const lang = EXTENSIONS[ext];
    if (lang) return lang;
  }
  const stem = dot > 0 ? base.slice(0, dot) : base;
  return BASENAMES[stem] ?? null;
}
