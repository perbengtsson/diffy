import { useEffect } from 'react';
import { useStdin, useStdout } from 'ink';
import {
  DISABLE_MOUSE,
  ENABLE_MOUSE,
  parseMouseEvent,
  type MouseEvent,
} from '../mouse/parseMouse.js';

export function useMouse(onEvent: (event: MouseEvent) => void): void {
  const { internal_eventEmitter } = useStdin();
  const { stdout } = useStdout();

  useEffect(() => {
    stdout.write(ENABLE_MOUSE);

    const handler = (chunk: string) => {
      const event = parseMouseEvent(chunk);
      if (event) onEvent(event);
    };

    internal_eventEmitter?.on('input', handler);
    return () => {
      internal_eventEmitter?.removeListener('input', handler);
      stdout.write(DISABLE_MOUSE);
    };
  }, [internal_eventEmitter, onEvent, stdout]);
}
