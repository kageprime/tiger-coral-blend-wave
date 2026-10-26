/** Held keys + touch stick + gamepad, folded into one frame of actions. */

export type InputBus = {
  read: () => {
    sx: number;
    sy: number;
    kickHeld: boolean;
    kickRelease: boolean;
    pass: boolean;
  };
  setStick: (x: number, y: number, active: boolean) => void;
  setKickHeld: (held: boolean) => void;
  tapPass: () => void;
  setKeys: (codes: string[]) => void;
  unlock: () => void;
  dispose: () => void;
};

export function createInput(onUnlock: () => void): InputBus {
  const keys = new Set<string>();
  let stickX = 0;
  let stickY = 0;
  let stickActive = false;
  let touchKick = false;
  let prevKick = false;
  let prevPass = false;
  let passPulses = 0;
  let prevPadPass = false;

  const down = (e: KeyboardEvent) => {
    if (e.repeat) return;
    keys.add(e.code);
    if (
      e.code === "Space" ||
      e.code === "ArrowUp" ||
      e.code === "ArrowDown" ||
      e.code === "ArrowLeft" ||
      e.code === "ArrowRight"
    ) {
      e.preventDefault();
    }
    onUnlock();
  };
  const up = (e: KeyboardEvent) => {
    keys.delete(e.code);
  };
  const clear = () => {
    keys.clear();
    touchKick = false;
    stickActive = false;
    stickX = 0;
    stickY = 0;
  };
  const onVis = () => {
    if (document.hidden) clear();
  };

  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  window.addEventListener("blur", clear);
  document.addEventListener("visibilitychange", onVis);

  function pad() {
    const list = navigator.getGamepads?.();
    if (!list) return null;
    for (const g of list) if (g) return g;
    return null;
  }

  return {
    setStick(x, y, active) {
      stickX = x;
      stickY = y;
      stickActive = active;
    },
    setKickHeld(held) {
      touchKick = held;
      if (held) onUnlock();
    },
    tapPass() {
      passPulses += 1;
      onUnlock();
    },
    setKeys(codes) {
      keys.clear();
      for (const c of codes) keys.add(c);
    },
    unlock: onUnlock,
    read() {
      let sx =
        (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) -
        (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
      let sy =
        (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) -
        (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);
      if (stickActive) {
        sx = stickX;
        sy = stickY;
      }
      const gp = pad();
      let padKick = false;
      let padPass = false;
      if (gp) {
        const ax = gp.axes[0] ?? 0;
        const ay = gp.axes[1] ?? 0;
        if (Math.hypot(ax, ay) > 0.18) {
          sx = Math.max(-1, Math.min(1, sx + ax));
          sy = Math.max(-1, Math.min(1, sy - ay));
        }
        padKick = !!(gp.buttons[0]?.pressed || gp.buttons[7]?.pressed);
        padPass = !!(gp.buttons[1]?.pressed || gp.buttons[2]?.pressed);
        if (Math.abs(sx) > 0.05 || Math.abs(sy) > 0.05 || padKick) onUnlock();
      }
      const mag = Math.hypot(sx, sy);
      if (mag > 1) {
        sx /= mag;
        sy /= mag;
      }
      const kickHeld = touchKick || keys.has("Space") || padKick;
      const kickRelease = prevKick && !kickHeld;
      prevKick = kickHeld;
      const passDown =
        keys.has("KeyJ") ||
        keys.has("KeyK") ||
        keys.has("ShiftLeft") ||
        keys.has("ShiftRight");
      const pass = (passDown && !prevPass) || passPulses > 0 || (padPass && !prevPadPass);
      passPulses = 0;
      prevPass = passDown;
      prevPadPass = padPass;
      return { sx, sy, kickHeld, kickRelease, pass };
    },
    dispose() {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", onVis);
      keys.clear();
    },
  };
}
