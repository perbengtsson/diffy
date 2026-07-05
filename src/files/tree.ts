import type { DiffFile } from '../git/types.js';

export type FileTreeNode = {
  name: string;
  path: string;
  kind: 'dir' | 'file';
  file?: DiffFile;
  children: FileTreeNode[];
};

export type FileTreeRow = {
  node: FileTreeNode;
  depth: number;
  isExpanded: boolean;
};

export function isEditedFile(file: DiffFile): boolean {
  return file.status !== 'unchanged';
}

export function countEditedFiles(files: DiffFile[]): number {
  return files.filter(isEditedFile).length;
}

export function findFirstEditedIndex(files: DiffFile[]): number {
  const idx = files.findIndex(isEditedFile);
  return idx >= 0 ? idx : 0;
}

export function buildFileTree(files: DiffFile[]): FileTreeNode[] {
  const root: FileTreeNode[] = [];

  for (const file of files) {
    const parts = file.path.split('/');
    let current = root;
    let pathSoFar = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      pathSoFar = pathSoFar ? `${pathSoFar}/${part}` : part;
      const isFile = i === parts.length - 1;

      if (isFile) {
        current.push({
          name: part,
          path: file.path,
          kind: 'file',
          file,
          children: [],
        });
      } else {
        let dir = current.find((node) => node.kind === 'dir' && node.name === part);
        if (!dir) {
          dir = { name: part, path: pathSoFar, kind: 'dir', children: [] };
          current.push(dir);
        }
        current = dir.children;
      }
    }
  }

  sortTree(root);
  return root;
}

function sortTree(nodes: FileTreeNode[]): void {
  nodes.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const node of nodes) {
    if (node.kind === 'dir') sortTree(node.children);
  }
}

export function buildDirsWithChanges(files: DiffFile[]): Set<string> {
  const dirs = new Set<string>();
  for (const file of files) {
    if (!isEditedFile(file)) continue;
    const parts = file.path.split('/');
    let path = '';
    for (let i = 0; i < parts.length - 1; i++) {
      path = path ? `${path}/${parts[i]}` : parts[i]!;
      dirs.add(path);
    }
  }
  return dirs;
}

export function buildInitialCollapsedDirs(files: DiffFile[]): Set<string> {
  const allDirs = new Set<string>();
  const expandedDirs = buildDirsWithChanges(files);

  for (const file of files) {
    const parts = file.path.split('/');
    let path = '';
    for (let i = 0; i < parts.length - 1; i++) {
      path = path ? `${path}/${parts[i]}` : parts[i]!;
      allDirs.add(path);
    }
  }

  const collapsed = new Set<string>();
  for (const dir of allDirs) {
    if (!expandedDirs.has(dir)) collapsed.add(dir);
  }
  return collapsed;
}

export function flattenFileTree(
  nodes: FileTreeNode[],
  collapsedDirs: ReadonlySet<string>,
  depth = 0,
): FileTreeRow[] {
  const rows: FileTreeRow[] = [];

  for (const node of nodes) {
    if (node.kind === 'dir') {
      const isExpanded = !collapsedDirs.has(node.path);
      rows.push({ node, depth, isExpanded });
      if (isExpanded) {
        rows.push(...flattenFileTree(node.children, collapsedDirs, depth + 1));
      }
    } else {
      rows.push({ node, depth, isExpanded: false });
    }
  }

  return rows;
}

export function findRowIndexForPath(rows: FileTreeRow[], path: string | undefined): number {
  if (!path) return 0;
  const idx = rows.findIndex((row) => row.node.kind === 'file' && row.node.path === path);
  return idx >= 0 ? idx : 0;
}

export function toggleDirCollapsed(
  collapsedDirs: ReadonlySet<string>,
  dirPath: string,
): Set<string> {
  const next = new Set(collapsedDirs);
  if (next.has(dirPath)) next.delete(dirPath);
  else next.add(dirPath);
  return next;
}

export function expandDirsForPath(
  collapsedDirs: ReadonlySet<string>,
  filePath: string,
): Set<string> {
  const next = new Set(collapsedDirs);
  const parts = filePath.split('/');
  let prefix = '';
  for (let i = 0; i < parts.length - 1; i++) {
    prefix = prefix ? `${prefix}/${parts[i]}` : parts[i]!;
    next.delete(prefix);
  }
  return next;
}

export function pruneCollapsedDirs(
  collapsedDirs: ReadonlySet<string>,
  files: DiffFile[],
): Set<string> {
  const valid = new Set<string>();
  for (const file of files) {
    const parts = file.path.split('/');
    let path = '';
    for (let i = 0; i < parts.length - 1; i++) {
      path = path ? `${path}/${parts[i]}` : parts[i]!;
      valid.add(path);
    }
  }

  const next = new Set<string>();
  for (const dir of collapsedDirs) {
    if (valid.has(dir)) next.add(dir);
  }
  return next;
}
