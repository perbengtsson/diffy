export type MouseClick = {
  x: number;
  y: number;
  button: number;
};

const SGR_MOUSE_RE = /^\x1b\[<(\d+);(\d+);(\d+)([mM])$/;

export function parseMouseEvent(data: string): MouseClick | null {
  const match = data.match(SGR_MOUSE_RE);
  if (!match) return null;

  const button = Number(match[1]);
  const x = Number(match[2]);
  const y = Number(match[3]);
  const action = match[4];

  if (action !== 'M' || button !== 0) return null;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  return { x, y, button };
}

export const ENABLE_MOUSE = '\x1b[?1000h\x1b[?1006h';
export const DISABLE_MOUSE = '\x1b[?1006l\x1b[?1000l';
