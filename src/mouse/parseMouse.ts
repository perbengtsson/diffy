export type MouseClick = {
  kind: 'click';
  x: number;
  y: number;
  button: number;
};

export type MouseWheel = {
  kind: 'wheel';
  x: number;
  y: number;
  direction: 'up' | 'down';
};

export type MouseDrag = {
  kind: 'drag';
  x: number;
  y: number;
  button: number;
};

export type MouseRelease = {
  kind: 'release';
  x: number;
  y: number;
  button: number;
};

export type MouseEvent = MouseClick | MouseWheel | MouseDrag | MouseRelease;

const SGR_MOUSE_RE = /^\x1b\[<(\d+);(\d+);(\d+)([mM])$/;

export function parseMouseEvent(data: string): MouseEvent | null {
  const match = data.match(SGR_MOUSE_RE);
  if (!match) return null;

  const button = Number(match[1]);
  const x = Number(match[2]);
  const y = Number(match[3]);
  const action = match[4];

  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  if (action === 'm' && button === 0) {
    return { kind: 'release', x, y, button };
  }

  if (action !== 'M') return null;

  if (button === 64) {
    return { kind: 'wheel', x, y, direction: 'up' };
  }
  if (button === 65) {
    return { kind: 'wheel', x, y, direction: 'down' };
  }
  if (button === 32) {
    return { kind: 'drag', x, y, button: 0 };
  }
  if (button !== 0) return null;

  return { kind: 'click', x, y, button };
}

export const ENABLE_MOUSE = '\x1b[?1002h\x1b[?1006h';
export const DISABLE_MOUSE = '\x1b[?1006l\x1b[?1002l';
