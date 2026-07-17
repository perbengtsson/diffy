export type DoubleClickState = {
  target: string | null;
  at: number;
};

export const EMPTY_DOUBLE_CLICK: DoubleClickState = { target: null, at: 0 };

export function registerClick(
  state: DoubleClickState,
  target: string,
  nowMs: number,
  windowMs = 400,
): { state: DoubleClickState; isDouble: boolean } {
  const isDouble =
    state.target === target && nowMs - state.at > 0 && nowMs - state.at <= windowMs;
  if (isDouble) {
    return { state: EMPTY_DOUBLE_CLICK, isDouble: true };
  }
  return { state: { target, at: nowMs }, isDouble: false };
}
