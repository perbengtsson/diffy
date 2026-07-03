import { loadDiffSnapshot } from '../dist/git/diff.js';
import {
  buildDisplayLines,
  expandHunk,
} from '../dist/diff/expand.js';

const snap = await loadDiffSnapshot(process.cwd(), {
  kind: 'uncommitted',
  stagedOnly: false,
});
console.log('mode:', snap.modeLabel);
console.log(
  'files:',
  snap.files.map((f) => `${f.path} [${f.status}] +${f.additions}/-${f.deletions}`),
);

const f = snap.files.find((x) => x.path === 'src/sample.ts');
if (f) {
  const lines = await buildDisplayLines(f, snap.mode, snap.repoRoot, new Map());
  console.log('display lines:', lines.length);

  const expansions = expandHunk(new Map(), 'src/sample.ts#0', 'before');
  const expanded = await buildDisplayLines(f, snap.mode, snap.repoRoot, expansions);
  console.log(
    'after expand before:',
    expanded.filter((l) => l.kind === 'expanded-context').length,
    'expanded-context lines',
  );
}

const baseSnap = await loadDiffSnapshot(process.cwd(), {
  kind: 'base',
  base: 'HEAD',
  includeUncommitted: false,
});
console.log('base mode files:', baseSnap.files.length);
