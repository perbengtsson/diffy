import { spawn } from 'node:child_process';
import { openSync, writeSync, closeSync } from 'node:fs';
import { platform } from 'node:os';

const CLIP_TIMEOUT_MS = 3000;

function runClipboardCommand(
  command: string,
  args: string[],
  text: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: ['pipe', 'ignore', 'ignore'],
    });
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(ok);
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      done(false);
    }, CLIP_TIMEOUT_MS);
    child.on('error', () => done(false));
    child.on('close', (code) => done(code === 0));
    child.stdin.on('error', () => done(false));
    child.stdin.end(text);
  });
}

/** OSC 52 — works in many terminals (including some multiplexers) without external tools. */
function copyViaOsc52(text: string): boolean {
  const payload = `\x1b]52;c;${Buffer.from(text, 'utf8').toString('base64')}\x07`;
  try {
    const fd = openSync('/dev/tty', 'w');
    try {
      writeSync(fd, payload);
      return true;
    } finally {
      closeSync(fd);
    }
  } catch {
    if (!process.stdout.isTTY) return false;
    try {
      process.stdout.write(payload);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * X11/Wayland clipboard via GTK (PyGObject), when xclip/wl-copy/xsel are missing.
 * Text is passed on stdin to avoid shell escaping issues.
 */
function copyViaGtkPython(text: string): Promise<boolean> {
  if (platform() !== 'linux') return Promise.resolve(false);
  if (!process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
    return Promise.resolve(false);
  }

  const script = `
import sys, time
try:
    import gi
    gi.require_version('Gtk', '3.0')
    from gi.repository import Gtk, Gdk
except Exception:
    sys.exit(1)
text = sys.stdin.read()
cb = Gtk.Clipboard.get(Gdk.SELECTION_CLIPBOARD)
cb.set_text(text, -1)
cb.store()
# Pump the loop so a clipboard manager can take ownership before we exit.
deadline = time.time() + 0.4
while time.time() < deadline:
    Gtk.main_iteration_do(False)
`;

  return runClipboardCommand('python3', ['-c', script], text);
}

/**
 * Copy plain text to the system clipboard.
 * Tries platform tools, then GTK via Python, then OSC 52 as a terminal fallback.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  const attempts: Array<[string, string[]]> =
    platform() === 'darwin'
      ? [['pbcopy', []]]
      : platform() === 'win32'
        ? [['clip', []]]
        : [
            ['wl-copy', []],
            ['xclip', ['-selection', 'clipboard']],
            ['xsel', ['--clipboard', '--input']],
          ];

  for (const [command, args] of attempts) {
    if (await runClipboardCommand(command, args, text)) {
      return true;
    }
  }

  if (await copyViaGtkPython(text)) {
    return true;
  }

  // Local graphical sessions: OSC 52 is unreliable (often a false positive).
  // Still emit it as best-effort for terminals that honor it, but only trust
  // it as success when there is no local display (e.g. SSH without X).
  const oscOk = copyViaOsc52(text);
  const hasLocalDisplay =
    platform() === 'linux' &&
    !!(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);
  if (hasLocalDisplay) return false;
  return oscOk;
}

/** Short hint when copy fails (platform-specific install tips). */
export function clipboardInstallHint(): string {
  if (platform() === 'darwin') return '';
  if (platform() === 'win32') return '';
  if (process.env.WAYLAND_DISPLAY) {
    return ' Install wl-clipboard (wl-copy).';
  }
  if (process.env.DISPLAY) {
    return ' Install xclip or xsel.';
  }
  return '';
}
