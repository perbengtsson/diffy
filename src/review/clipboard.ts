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

/**
 * OSC 52 — clipboard (`c`) and primary (`p`) for terminals that honor them.
 * Works in many terminals (including some multiplexers) without external tools.
 */
function copyViaOsc52(text: string): boolean {
  const b64 = Buffer.from(text, 'utf8').toString('base64');
  const payload = `\x1b]52;c;${b64}\x07\x1b]52;p;${b64}\x07`;
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
 * X11/Wayland CLIPBOARD via GTK (PyGObject), when xclip/wl-copy/xsel are missing.
 * Text is passed on stdin to avoid shell escaping issues.
 */
function copyClipboardViaGtkPython(text: string): Promise<boolean> {
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
 * Hold X11 PRIMARY (middle-click paste) until something else claims it.
 * CLIPBOARD can be handed off to a manager via store(); PRIMARY usually cannot,
 * so we keep a detached GTK owner alive (same model as xclip).
 */
function holdPrimaryViaGtkPython(text: string): void {
  if (platform() !== 'linux') return;
  if (!process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) return;

  const script = `
import sys
try:
    import gi
    gi.require_version('Gtk', '3.0')
    from gi.repository import Gtk, Gdk, GLib
except Exception:
    sys.exit(1)
text = sys.stdin.read()
cb = Gtk.Clipboard.get(Gdk.SELECTION_PRIMARY)
cb.set_text(text, -1)
# Ignore the owner-change from us claiming PRIMARY; quit on the next loss.
ignore = [1]
def on_owner_change(_clipboard, _event):
    if ignore[0] > 0:
        ignore[0] -= 1
        return
    Gtk.main_quit()
cb.connect('owner-change', on_owner_change)
# Don't leak forever if owner-change never fires.
GLib.timeout_add_seconds(3600, Gtk.main_quit)
Gtk.main()
`;

  try {
    const child = spawn('python3', ['-c', script], {
      stdio: ['pipe', 'ignore', 'ignore'],
      detached: true,
    });
    child.on('error', () => {
      /* best-effort */
    });
    child.stdin.on('error', () => {
      /* best-effort */
    });
    child.stdin.end(text, () => {
      child.unref();
    });
  } catch {
    /* best-effort */
  }
}

/** Best-effort PRIMARY (middle-click) via platform CLI tools. */
async function copyPrimaryLinux(text: string): Promise<boolean> {
  const attempts: Array<[string, string[]]> = [
    ['wl-copy', ['--primary']],
    ['xclip', ['-selection', 'primary']],
    ['xsel', ['--primary', '--input']],
  ];
  for (const [command, args] of attempts) {
    if (await runClipboardCommand(command, args, text)) {
      return true;
    }
  }
  holdPrimaryViaGtkPython(text);
  // Detached holder: treat as attempted; CLIPBOARD success is what we report.
  return false;
}

/**
 * Copy plain text to the system clipboard (Ctrl+V) and, on Linux, also to
 * PRIMARY so middle-mouse paste works in native terminals.
 * Tries platform tools, then GTK via Python, then OSC 52 as a terminal fallback.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  if (platform() === 'darwin') {
    return runClipboardCommand('pbcopy', [], text);
  }
  if (platform() === 'win32') {
    return runClipboardCommand('clip', [], text);
  }

  // Linux: CLIPBOARD first (Ctrl+V), then PRIMARY (middle-click).
  const clipboardAttempts: Array<[string, string[]]> = [
    ['wl-copy', []],
    ['xclip', ['-selection', 'clipboard']],
    ['xsel', ['--clipboard', '--input']],
  ];

  let clipboardOk = false;
  for (const [command, args] of clipboardAttempts) {
    if (await runClipboardCommand(command, args, text)) {
      clipboardOk = true;
      break;
    }
  }

  if (!clipboardOk) {
    clipboardOk = await copyClipboardViaGtkPython(text);
  }

  // Always try PRIMARY when we have a local display (even if CLIPBOARD failed,
  // a terminal may still paste from PRIMARY).
  await copyPrimaryLinux(text);

  if (clipboardOk) return true;

  // Local graphical sessions: OSC 52 is unreliable (often a false positive).
  // Still emit it as best-effort for terminals that honor it, but only trust
  // it as success when there is no local display (e.g. SSH without X).
  const oscOk = copyViaOsc52(text);
  const hasLocalDisplay = !!(
    process.env.DISPLAY || process.env.WAYLAND_DISPLAY
  );
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
