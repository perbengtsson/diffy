import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';
import { clipboardInstallHint, copyToClipboard } from './clipboard.js';

function readGtkSelection(selection: 'CLIPBOARD' | 'PRIMARY'): string | null {
  const read = spawnSync(
    'python3',
    [
      '-c',
      `import gi; gi.require_version('Gtk','3.0'); from gi.repository import Gtk,Gdk; print(Gtk.Clipboard.get(Gdk.SELECTION_${selection}).wait_for_text() or '')`,
    ],
    { encoding: 'utf8' },
  );
  if (read.status !== 0) return null;
  return read.stdout.trimEnd();
}

describe('copyToClipboard', () => {
  it('returns false for empty text', async () => {
    assert.equal(await copyToClipboard(''), false);
  });

  it('copies non-empty text when a graphical clipboard backend is available', async () => {
    const sample = `diffy-clipboard-test-${Date.now()}`;
    const ok = await copyToClipboard(sample);
    if (!ok) {
      assert.equal(typeof clipboardInstallHint(), 'string');
      return;
    }

    if (!process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) return;

    const clip = readGtkSelection('CLIPBOARD');
    if (clip === null) return;
    assert.equal(clip, sample);

    // Give the detached PRIMARY holder a moment to claim the selection.
    await new Promise((r) => setTimeout(r, 200));
    const primary = readGtkSelection('PRIMARY');
    if (primary === null) return;
    assert.equal(primary, sample);
  });
});

describe('clipboardInstallHint', () => {
  it('returns a string', () => {
    assert.equal(typeof clipboardInstallHint(), 'string');
  });
});
