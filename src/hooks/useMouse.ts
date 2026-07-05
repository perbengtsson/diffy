import { useEffect } from 'react';
import { useStdin, useStdout } from 'ink';
import {
  DISABLE_MOUSE,
  ENABLE_MOUSE,
  parseMouseEvent,
  type MouseClick,
} from '../mouse/parseMouse.js';

export function useMouse(onClick: (click: MouseClick) => void): void {
  const { internal_eventEmitter } = useStdin();
  const { stdout } = useStdout();

  useEffect(() => {
    stdout.write(ENABLE_MOUSE);

    const handler = (chunk: string) => {
      const click = parseMouseEvent(chunk);
      if (click) onClick(click);
    };

    internal_eventEmitter?.on('input', handler);
    return () => {
      internal_eventEmitter?.removeListener('input', handler);
      stdout.write(DISABLE_MOUSE);
    };
  }, [internal_eventEmitter, onClick, stdout]);
}
