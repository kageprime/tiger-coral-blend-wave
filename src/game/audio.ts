/** Tiny synthesized cues. The context stays suspended until a gesture. */

export type AudioBus = {
  unlock: () => void;
  kick: (hard: boolean) => void;
  post: () => void;
  goal: () => void;
  whistle: () => void;
  out: () => void;
  dispose: () => void;
};

export function createAudio(): AudioBus {
  let ctx: AudioContext | null = null;
  let armed = false;

  function ac() {
    if (!ctx) ctx = new AudioContext();
    return ctx;
  }

  function ready(fn: () => void) {
    if (!armed) return;
    const c = ac();
    if (c.state === "running") fn();
    else void c.resume().then(fn).catch(() => {});
  }

  function envGain(c: AudioContext, duration: number, peak: number) {
    const g = c.createGain();
    const t = c.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    g.connect(c.destination);
    return { g, t };
  }

  function tone(freq: number, duration: number, type: OscillatorType, peak: number, slide = 0) {
    const c = ac();
    const { g, t } = envGain(c, duration, peak);
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(48, freq + slide), t + duration);
    o.connect(g);
    o.start(t);
    o.stop(t + duration + 0.02);
  }

  function noise(duration: number, peak: number, freq: number) {
    const c = ac();
    const { g, t } = envGain(c, duration, peak);
    const n = Math.floor(c.sampleRate * duration);
    const buf = c.createBuffer(1, Math.max(1, n), c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(freq, t);
    src.connect(filter);
    filter.connect(g);
    src.start(t);
  }

  const onVis = () => {
    if (!document.hidden && armed && ctx && ctx.state === "suspended") void ctx.resume();
  };
  document.addEventListener("visibilitychange", onVis);

  return {
    unlock() {
      armed = true;
      const c = ac();
      if (c.state === "suspended") void c.resume().catch(() => {});
    },
    kick(hard) {
      ready(() => {
        noise(hard ? 0.09 : 0.055, hard ? 0.14 : 0.08, hard ? 380 : 700);
        tone(hard ? 110 : 170, hard ? 0.12 : 0.07, "sine", hard ? 0.09 : 0.05, hard ? -36 : -28);
      });
    },
    post() {
      ready(() => {
        tone(340, 0.06, "square", 0.035, 90);
        noise(0.04, 0.04, 980);
      });
    },
    goal() {
      ready(() => {
        noise(0.2, 0.07, 1500);
        tone(523, 0.16, "sine", 0.055, 70);
        tone(784, 0.2, "triangle", 0.035, 30);
      });
    },
    whistle() {
      ready(() => {
        tone(880, 0.08, "sine", 0.045, 160);
        tone(1020, 0.14, "sine", 0.035, -50);
      });
    },
    out() {
      ready(() => tone(210, 0.07, "triangle", 0.04, -30));
    },
    dispose() {
      document.removeEventListener("visibilitychange", onVis);
      if (ctx) void ctx.close();
      ctx = null;
      armed = false;
    },
  };
}
