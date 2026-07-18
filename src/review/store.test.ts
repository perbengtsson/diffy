import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, after } from 'node:test';
import type { DisplayLine } from '../diff/types.js';
import {
  commentKey,
  commentedLineKeysForPath,
  emptySession,
  findComment,
  openOrCreateSession,
  persistSession,
  resolveLineTarget,
  resolveResumePath,
  reviewBasename,
  reviewFilePath,
  sanitizeBranch,
  saveSession,
  todayDate,
  upsertComment,
} from './store.js';
import { compileReview, formatReviewTerminal, resumeCommand } from './compile.js';

describe('sanitizeBranch', () => {
  it('replaces slashes and colons', () => {
    assert.equal(sanitizeBranch('feature/foo'), 'feature-foo');
    assert.equal(sanitizeBranch('refs/heads/main'), 'refs-heads-main');
  });
});

describe('review paths', () => {
  it('builds basename and path', () => {
    assert.equal(
      reviewBasename('main', '2026-07-18-1024'),
      'review-main-2026-07-18-1024.json',
    );
    assert.equal(
      reviewFilePath('main', '2026-07-18-1024', '/home/u'),
      join('/home/u', '.config', 'diffy', 'review-main-2026-07-18-1024.json'),
    );
  });

  it('resolves resume args', () => {
    assert.equal(
      resolveResumePath(true, 'main', '2026-07-18-1024', '/home/u'),
      reviewFilePath('main', '2026-07-18-1024', '/home/u'),
    );
    assert.equal(
      resolveResumePath('review-main-2026-07-18-1024', 'main', '2026-07-18-1024', '/home/u'),
      join('/home/u', '.config', 'diffy', 'review-main-2026-07-18-1024.json'),
    );
    assert.equal(
      resolveResumePath('/abs/x.json', 'main', '2026-07-18-1024', '/home/u'),
      '/abs/x.json',
    );
  });
});

describe('todayDate', () => {
  it('formats YYYY-MM-DD-HHMM in local time', () => {
    const local = new Date(2026, 6, 18, 10, 24, 0); // Jul 18 2026 10:24 local
    assert.equal(todayDate(local), '2026-07-18-1024');
  });
});

describe('resolveLineTarget', () => {
  it('maps add/delete/context', () => {
    assert.deepEqual(
      resolveLineTarget({ kind: 'add', content: 'a', newLineNo: 5 }),
      { side: 'new', line: 5, snippet: 'a' },
    );
    assert.deepEqual(
      resolveLineTarget({ kind: 'delete', content: 'd', oldLineNo: 3 }),
      { side: 'old', line: 3, snippet: 'd' },
    );
    assert.deepEqual(
      resolveLineTarget({
        kind: 'context',
        content: 'c',
        oldLineNo: 1,
        newLineNo: 2,
      }),
      { side: 'context', line: 2, snippet: 'c', otherLine: 1 },
    );
    assert.deepEqual(
      resolveLineTarget({
        kind: 'context',
        content: 'same',
        oldLineNo: 4,
        newLineNo: 4,
      }),
      { side: 'context', line: 4, snippet: 'same' },
    );
  });

  it('rejects headers', () => {
    assert.equal(
      resolveLineTarget({ kind: 'hunk-header', content: '@@' } as DisplayLine),
      null,
    );
  });
});

describe('upsertComment', () => {
  const base = emptySession('/repo', 'main', '2026-07-18-1024');

  it('adds, edits, and deletes', () => {
    let s = upsertComment(base, {
      path: 'a.ts',
      side: 'new',
      line: 10,
      body: ' first ',
      snippet: 'x',
      now: new Date('2026-07-18T10:00:00Z'),
    });
    assert.equal(s.comments.length, 1);
    assert.equal(s.comments[0]!.body, 'first');
    const id = s.comments[0]!.id;

    s = upsertComment(s, {
      path: 'a.ts',
      side: 'new',
      line: 10,
      body: 'edited',
      snippet: 'x',
      now: new Date('2026-07-18T11:00:00Z'),
    });
    assert.equal(s.comments.length, 1);
    assert.equal(s.comments[0]!.id, id);
    assert.equal(s.comments[0]!.body, 'edited');

    s = upsertComment(s, {
      path: 'a.ts',
      side: 'new',
      line: 10,
      body: '   ',
      snippet: 'x',
    });
    assert.equal(s.comments.length, 0);
  });

  it('findComment and commentKey work', () => {
    const s = upsertComment(base, {
      path: 'a.ts',
      side: 'old',
      line: 1,
      body: 'n',
      snippet: 's',
    });
    assert.ok(findComment(s, 'a.ts', 'old', 1));
    assert.equal(commentKey('a.ts', 'old', 1), `a.ts\0old\0${1}`);
  });
});

describe('compileReview', () => {
  it('returns empty for no comments', () => {
    assert.equal(compileReview(emptySession('/r', 'main', '2026-07-18-1024')), '');
  });

  it('formats markdown by file and line', () => {
    let s = emptySession('/r', 'main', '2026-07-18-1024');
    s = upsertComment(s, {
      path: 'b.ts',
      side: 'new',
      line: 2,
      body: 'second',
      snippet: 'line2',
    });
    s = upsertComment(s, {
      path: 'a.ts',
      side: 'old',
      line: 10,
      body: 'first',
      snippet: 'line10',
    });
    const md = compileReview(s);
    assert.match(md, /# Diffy review — main — 2026-07-18-1024/);
    assert.match(md, /Line anchors:.*\(old\).*deleted/);
    assert.match(md, /## a\.ts/);
    assert.match(md, /### L10 \(old\)/);
    assert.match(md, /> line10/);
    assert.match(md, /first/);
    assert.match(md, /## b\.ts/);
  });

  it('labels unchanged lines as context', () => {
    let s = emptySession('/r', 'main', '2026-07-18-1024');
    s = upsertComment(s, {
      path: 'a.ts',
      side: 'context',
      line: 5,
      body: 'look here',
      snippet: 'unchanged',
      otherLine: 3,
    });
    const md = compileReview(s);
    assert.match(md, /### L5 \(context; old L3\)/);
    assert.match(md, /Line anchors:.*\(context\).*unchanged/);
  });
});

describe('resumeCommand', () => {
  it('formats a resume CLI from the cache path', () => {
    assert.equal(
      resumeCommand('/home/u/.config/diffy/review-main-2026-07-18-1024.json'),
      'diffy --resume review-main-2026-07-18-1024',
    );
  });
});

describe('formatReviewTerminal', () => {
  it('returns empty for no comments', () => {
    assert.equal(formatReviewTerminal(emptySession('/r', 'main', '2026-07-18-1024')), '');
  });

  it('includes headings and comment body', () => {
    const s = upsertComment(emptySession('/r', 'main', '2026-07-18-1024'), {
      path: 'a.ts',
      side: 'new',
      line: 2,
      body: 'fix me',
      snippet: 'x',
    });
    const out = formatReviewTerminal(s);
    assert.match(out, /Diffy review/);
    assert.match(out, /a\.ts/);
    assert.match(out, /fix me/);
    assert.match(out, /L2 \(new\)/);
  });
});

describe('openOrCreateSession + save', () => {
  let home = '';

  after(async () => {
    if (home) await rm(home, { recursive: true, force: true });
  });

  it('saves and reloads matching repo', async () => {
    home = await mkdtemp(join(tmpdir(), 'diffy-review-'));
    let s = emptySession('/repo', 'main', '2026-07-18-1024');
    s = upsertComment(s, {
      path: 'f.ts',
      side: 'new',
      line: 1,
      body: 'hi',
      snippet: 'x',
    });
    const path = reviewFilePath('main', '2026-07-18-1024', home);
    await saveSession(path, s);

    const opened = await openOrCreateSession({
      repoRoot: '/repo',
      branch: 'main',
      date: '2026-07-18-1024',
      home,
    });
    assert.equal(opened.path, path);
    assert.equal(opened.session.comments.length, 1);
    assert.equal(opened.session.comments[0]!.body, 'hi');
  });

  it('starts fresh when repoRoot mismatches auto path', async () => {
    const opened = await openOrCreateSession({
      repoRoot: '/other',
      branch: 'main',
      date: '2026-07-18-1024',
      home,
    });
    assert.equal(opened.session.comments.length, 0);
    assert.equal(opened.session.repoRoot, '/other');
  });

  it('bare --resume loads the latest review for the repo', async () => {
    const older = emptySession('/repo', 'main', '2026-07-18-0900');
    const newer = upsertComment(
      emptySession('/repo', 'main', '2026-07-18-1030'),
      {
        path: 'a.ts',
        side: 'new',
        line: 1,
        body: 'latest',
        snippet: 'x',
      },
    );
    await saveSession(reviewFilePath('main', '2026-07-18-0900', home), older);
    await saveSession(reviewFilePath('main', '2026-07-18-1030', home), newer);

    const opened = await openOrCreateSession({
      repoRoot: '/repo',
      branch: 'main',
      date: '2026-07-18-1200',
      resume: true,
      home,
    });
    assert.equal(opened.path, reviewFilePath('main', '2026-07-18-1030', home));
    assert.equal(opened.session.comments[0]!.body, 'latest');
  });
});

describe('commentedLineKeysForPath', () => {
  it('returns side:line keys', () => {
    let s = emptySession('/r', 'main', '2026-07-18-1024');
    s = upsertComment(s, {
      path: 'a.ts',
      side: 'new',
      line: 5,
      body: 'x',
      snippet: 'y',
    });
    const keys = commentedLineKeysForPath(s, 'a.ts');
    assert.ok(keys.has('new:5'));
    assert.equal(commentedLineKeysForPath(s, 'b.ts').size, 0);
  });
});

describe('saveSession roundtrip', () => {
  it('writes readable json', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'diffy-save-'));
    try {
      const path = join(dir, 'review.json');
      const s = upsertComment(emptySession('/r', 'main', '2026-07-18-1024'), {
        path: 'a.ts',
        side: 'new',
        line: 1,
        body: 'ok',
        snippet: 'z',
      });
      await saveSession(path, s);
      const raw = await readFile(path, 'utf8');
      assert.match(raw, /"version": 1/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('persistSession', () => {
  it('does not create a file for empty reviews', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'diffy-persist-'));
    try {
      const path = join(dir, 'review-main-2026-07-18-1024.json');
      await persistSession(path, emptySession('/r', 'main', '2026-07-18-1024'));
      await assert.rejects(() => readFile(path), { code: 'ENOENT' });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('writes when comments exist and removes when cleared', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'diffy-persist-'));
    try {
      const path = join(dir, 'review-main-2026-07-18-1024.json');
      let s = upsertComment(emptySession('/r', 'main', '2026-07-18-1024'), {
        path: 'a.ts',
        side: 'new',
        line: 1,
        body: 'ok',
        snippet: 'z',
      });
      await persistSession(path, s);
      assert.match(await readFile(path, 'utf8'), /"ok"/);

      s = upsertComment(s, {
        path: 'a.ts',
        side: 'new',
        line: 1,
        body: '',
        snippet: 'z',
      });
      await persistSession(path, s);
      await assert.rejects(() => readFile(path), { code: 'ENOENT' });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
