import { spawn } from 'node:child_process';
import { buildEditorInvocation } from './editorCommand.js';

export type RunExternalEditorOptions = {
  filePath: string;
  line?: number;
  env?: NodeJS.ProcessEnv;
  /** Called immediately before the editor is spawned. */
  onBeforeSpawn?: () => void;
  /** Called after the editor exits (success or failure). */
  onAfterSpawn?: () => void;
};

export type RunExternalEditorResult =
  | { ok: true; command: string }
  | { ok: false; command: string; error: string };

/** Spawn $VISUAL / $EDITOR / nano with the TTY inherited. */
export function runExternalEditor(
  options: RunExternalEditorOptions,
): Promise<RunExternalEditorResult> {
  const env = options.env ?? process.env;
  const { command, args } = buildEditorInvocation(
    options.filePath,
    options.line,
    env,
  );

  options.onBeforeSpawn?.();

  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env,
    });

    const finish = (result: RunExternalEditorResult) => {
      try {
        options.onAfterSpawn?.();
      } finally {
        resolve(result);
      }
    };

    child.on('error', (err) => {
      finish({
        ok: false,
        command,
        error: err.message || String(err),
      });
    });

    child.on('close', (code, signal) => {
      if (code === 0 || code === null) {
        finish({ ok: true, command });
        return;
      }
      finish({
        ok: false,
        command,
        error: signal
          ? `${command} killed by ${signal}`
          : `${command} exited with code ${code}`,
      });
    });
  });
}
