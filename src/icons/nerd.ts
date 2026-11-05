/**
 * Curated Nerd Font (Seti / Devicons) glyphs + colors for the file tree.
 * Single BMP PUA codepoints so JS `.length` matches terminal cells.
 */

const DEFAULT_FILE = '\uE612'; // 
const DEFAULT_FILE_FG = '#6D8086';

type IconStyle = { glyph: string; color: string };

/** Exact basename (case-insensitive) → style. */
const BY_BASENAME: Readonly<Record<string, IconStyle>> = {
  dockerfile: { glyph: '\uE7B0', color: '#4584b6' }, // 
  'docker-compose.yml': { glyph: '\uE7B0', color: '#4584b6' },
  'docker-compose.yaml': { glyph: '\uE7B0', color: '#4584b6' },
  makefile: { glyph: '\uE779', color: '#6d8086' }, // 
  gnumakefile: { glyph: '\uE779', color: '#6d8086' },
  '.gitignore': { glyph: '\uE702', color: '#e24329' }, // 
  '.gitattributes': { glyph: '\uE702', color: '#e24329' },
  '.gitmodules': { glyph: '\uE702', color: '#e24329' },
  'readme.md': { glyph: '\uE609', color: '#42a5f5' }, // 
  readme: { glyph: '\uE609', color: '#42a5f5' },
  license: { glyph: '\uE60A', color: '#d4af37' }, // 
  'license.md': { glyph: '\uE60A', color: '#d4af37' },
  'cargo.toml': { glyph: '\uE68B', color: '#dea584' }, // 
  'cargo.lock': { glyph: '\uE68B', color: '#dea584' },
  'go.mod': { glyph: '\uE627', color: '#519aba' }, // 
  'go.sum': { glyph: '\uE627', color: '#519aba' },
  gemfile: { glyph: '\uE739', color: '#cc3e44' }, // 
  rakefile: { glyph: '\uE739', color: '#cc3e44' },
  'cmakelists.txt': { glyph: '\uE61E', color: '#e37933' }, // 
};

/** Extension (lowercase, no dot) → style. */
const BY_EXT: Readonly<Record<string, IconStyle>> = {
  ts: { glyph: '\uE628', color: '#519aba' }, // 
  tsx: { glyph: '\uE628', color: '#519aba' },
  mts: { glyph: '\uE628', color: '#519aba' },
  cts: { glyph: '\uE628', color: '#519aba' },
  js: { glyph: '\uE60C', color: '#cbcb41' }, // 
  jsx: { glyph: '\uE60C', color: '#cbcb41' },
  mjs: { glyph: '\uE60C', color: '#cbcb41' },
  cjs: { glyph: '\uE60C', color: '#cbcb41' },
  json: { glyph: '\uE60B', color: '#cbcb41' }, //  nf-seti-json / e60b
  jsonc: { glyph: '\uE60B', color: '#cbcb41' },
  md: { glyph: '\uE609', color: '#42a5f5' }, // 
  mdx: { glyph: '\uE609', color: '#519aba' },
  markdown: { glyph: '\uE609', color: '#42a5f5' },
  py: { glyph: '\uE606', color: '#ffbc03' }, // 
  pyi: { glyph: '\uE606', color: '#ffbc03' },
  go: { glyph: '\uE627', color: '#519aba' }, // 
  rs: { glyph: '\uE68B', color: '#dea584' }, // 
  css: { glyph: '\uE614', color: '#42a5f5' }, // 
  scss: { glyph: '\uE614', color: '#f55385' },
  sass: { glyph: '\uE614', color: '#f55385' },
  less: { glyph: '\uE614', color: '#563d7c' },
  html: { glyph: '\uE60E', color: '#e37933' }, // 
  htm: { glyph: '\uE60E', color: '#e37933' },
  yml: { glyph: '\uE60B', color: '#6d8086' },
  yaml: { glyph: '\uE60B', color: '#6d8086' },
  toml: { glyph: '\uE60B', color: '#6d8086' },
  xml: { glyph: '\uE60B', color: '#e37933' },
  svg: { glyph: '\uE60D', color: '#ffb13b' }, // 
  png: { glyph: '\uE60D', color: '#a074c4' },
  jpg: { glyph: '\uE60D', color: '#a074c4' },
  jpeg: { glyph: '\uE60D', color: '#a074c4' },
  gif: { glyph: '\uE60D', color: '#a074c4' },
  webp: { glyph: '\uE60D', color: '#a074c4' },
  ico: { glyph: '\uE60D', color: '#cbcb41' },
  sh: { glyph: '\uE755', color: '#4d5a5e' }, // 
  bash: { glyph: '\uE755', color: '#4d5a5e' },
  zsh: { glyph: '\uE755', color: '#4d5a5e' },
  fish: { glyph: '\uE755', color: '#4d5a5e' },
  c: { glyph: '\uE61E', color: '#599eff' }, // 
  h: { glyph: '\uE61E', color: '#a074c4' },
  cpp: { glyph: '\uE61D', color: '#f34b7d' }, // 
  cxx: { glyph: '\uE61D', color: '#f34b7d' },
  cc: { glyph: '\uE61D', color: '#f34b7d' },
  hpp: { glyph: '\uE61D', color: '#a074c4' },
  java: { glyph: '\uE738', color: '#cc3e44' }, // 
  kt: { glyph: '\uE738', color: '#7F52FF' },
  kts: { glyph: '\uE738', color: '#7F52FF' },
  rb: { glyph: '\uE739', color: '#cc3e44' }, // 
  php: { glyph: '\uE73D', color: '#a074c4' }, // 
  lua: { glyph: '\uE620', color: '#51a0cf' }, // 
  vim: { glyph: '\uE62B', color: '#019833' }, // 
  sql: { glyph: '\uE706', color: '#dad8d8' }, // 
  graphql: { glyph: '\uE60B', color: '#e535ab' },
  gql: { glyph: '\uE60B', color: '#e535ab' },
  vue: { glyph: '\uE6A1', color: '#8dc149' }, // 
  svelte: { glyph: '\uE697', color: '#ff3e00' }, // 
  solid: { glyph: '\uE628', color: '#2c4f7c' },
  zig: { glyph: '\uE6A9', color: '#f69a1b' }, // 
  nix: { glyph: '\uE6A5', color: '#7ebae4' }, // 
  tf: { glyph: '\uE69A', color: '#5F43E9' }, // 
  hcl: { glyph: '\uE69A', color: '#5F43E9' },
  dockerfile: { glyph: '\uE7B0', color: '#4584b6' }, // 
  rsx: { glyph: '\uE68B', color: '#dea584' },
  txt: { glyph: DEFAULT_FILE, color: DEFAULT_FILE_FG },
  log: { glyph: DEFAULT_FILE, color: DEFAULT_FILE_FG },
};

export type TreeIconInput = {
  name: string;
  kind?: 'file';
};

export type TreeIcon = {
  /** Single-cell Nerd Font glyph. */
  glyph: string;
  /** Hex/named color for the glyph (not git-status). */
  color: string;
};

/** Resolve glyph + color for a file (dirs use ⏵/⏷ fold markers in the UI). */
export function resolveTreeIcon(input: TreeIconInput): TreeIcon {
  const lower = input.name.toLowerCase();
  const byName = BY_BASENAME[lower];
  if (byName) return byName;

  const dot = lower.lastIndexOf('.');
  if (dot > 0 && dot < lower.length - 1) {
    const byExt = BY_EXT[lower.slice(dot + 1)];
    if (byExt) return byExt;
  }

  return { glyph: DEFAULT_FILE, color: DEFAULT_FILE_FG };
}

/** Build a 2-cell treePrefix (glyph + trailing space). */
export function formatTreeIconPrefix(glyph: string): string {
  return `${glyph} `;
}

/** Icon prefix for use as a FileList treePrefix (2 cells). */
export function treeIconPrefix(input: TreeIconInput): string {
  return formatTreeIconPrefix(resolveTreeIcon(input).glyph);
}
