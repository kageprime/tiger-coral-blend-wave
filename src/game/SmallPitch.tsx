import { useEffect, useRef, useState, type ReactNode } from "react";
import { mount, type MountHandle, type PhaseSnap } from "./mount";
import { loadRecord, saveResult, type Record } from "./save";

const TITLE: PhaseSnap = { phase: "title", score: [0, 0], winner: -1, banner: "" };

export function SmallPitch() {
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const api = useRef<MountHandle | null>(null);
  const recorded = useRef(false);
  const els = useRef({
    clock: null as HTMLElement | null,
    scoreA: null as HTMLElement | null,
    scoreB: null as HTMLElement | null,
    charge: null as HTMLElement | null,
    status: null as HTMLElement | null,
  }).current;
  const [snap, setSnap] = useState<PhaseSnap>(TITLE);
  const [record, setRecord] = useState<Record | null>(null);
  const [stick, setStick] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setRecord(loadRecord());
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const handle = mount(canvas, {
      els,
      reducedMotion,
      onSnap: (next) => {
        setSnap(next);
        if (next.phase === "play") recorded.current = false;
        if (next.phase === "over" && !recorded.current) {
          recorded.current = true;
          setRecord(saveResult(next.score, next.winner));
        }
      },
    });
    api.current = handle;
    return () => {
      handle.dispose();
      api.current = null;
    };
  }, [els]);

  const playing = snap.phase === "play" || snap.phase === "goal";

  return (
    <div className="flex h-dvh touch-none flex-col overflow-hidden bg-ivory text-ink select-none">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <p className="font-display text-xl leading-none italic">Small Pitch</p>
        <div className="flex items-center gap-3">
          <ScoreMark label="Teal" valueRef={(n) => { els.scoreA = n; }} tone="text-teal" />
          <div className="flex flex-col items-center">
            <span
              ref={(n) => {
                els.clock = n;
              }}
              className="font-sans text-sm font-medium tabular-nums"
            >
              1:10
            </span>
            <span className="mt-1 block h-1 w-14 overflow-hidden rounded-full bg-line opacity-0">
              <span
                ref={(n) => {
                  els.charge = n;
                }}
                className="block h-full w-full origin-left bg-teal"
              />
            </span>
          </div>
          <ScoreMark label="Ash" valueRef={(n) => { els.scoreB = n; }} tone="text-ink" />
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        <div ref={frameRef} className="absolute inset-0 grid place-items-center">
          <canvas ref={canvasRef} width={360} height={270} className="pixel" />
        </div>

        <p
          ref={(n) => {
            els.status = n;
          }}
          className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 font-sans text-xs tracking-widest text-muted uppercase"
        />

        {snap.phase === "goal" ? (
          <p className="banner-rise pointer-events-none absolute top-12 left-1/2 -translate-x-1/2 font-display text-6xl italic">
            Goal
          </p>
        ) : null}

        {snap.phase === "title" ? (
          <Card>
            <p className="font-sans text-xs tracking-widest text-muted uppercase">Five-a-side</p>
            <h1 className="mt-1 font-display text-5xl leading-none italic">Small Pitch</h1>
            <p className="mt-3 max-w-xs font-sans text-sm leading-relaxed text-muted">
              A miniature match on a floating pitch. First to three, or seventy seconds.
            </p>
            {record && record.played > 0 ? (
              <p className="mt-2 font-sans text-sm text-ink">
                {record.wins} {record.wins === 1 ? "win" : "wins"} from {record.played}
              </p>
            ) : null}
            <button
              type="button"
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-teal px-6 font-sans text-base font-medium text-ivory"
              onClick={() => api.current?.start()}
            >
              Kick off
            </button>
          </Card>
        ) : null}

        {snap.phase === "over" ? (
          <Card>
            <p className="font-sans text-xs tracking-widest text-muted uppercase">Full time</p>
            <h2 className="mt-1 font-display text-4xl leading-none italic">{verdict(snap.winner)}</h2>
            <p className="mt-3 font-sans text-2xl tabular-nums">
              <span className="text-teal">{snap.score[0]}</span>
              <span className="mx-2 text-muted">–</span>
              <span>{snap.score[1]}</span>
            </p>
            <button
              type="button"
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-teal px-6 font-sans text-base font-medium text-ivory"
              onClick={() => api.current?.start()}
            >
              Rematch
            </button>
          </Card>
        ) : null}
      </div>

      <footer className="dock border-t border-line px-4 pt-3">
        {playing ? (
          <>
            <p className="hidden text-center font-sans text-sm text-muted md:block">
              <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> move
              <span className="mx-2 text-line">·</span>
              hold <kbd>Space</kbd> to shoot
              <span className="mx-2 text-line">·</span>
              <kbd>J</kbd> pass
            </p>
            <div className="flex items-end justify-between md:hidden">
              <Stick
                knob={stick}
                onChange={(x, y, active) => {
                  setStick(active ? { x, y } : { x: 0, y: 0 });
                  api.current?.input.setStick(x, y, active);
                }}
              />
              <div className="flex gap-3">
                <RoundButton
                  label="Pass"
                  onDown={() => api.current?.input.tapPass()}
                />
                <RoundButton
                  label="Shoot"
                  accent
                  onDown={() => api.current?.input.setKickHeld(true)}
                  onUp={() => api.current?.input.setKickHeld(false)}
                />
              </div>
            </div>
          </>
        ) : (
          <p className="pb-1 text-center font-sans text-xs text-muted">Teal is you. The ring marks your feet.</p>
        )}
      </footer>
      <p className="sr-only" aria-live="polite">
        {snap.banner || (snap.phase === "over" ? verdict(snap.winner) : "")}
      </p>
    </div>
  );
}

function ScoreMark({
  label,
  valueRef,
  tone,
}: {
  label: string;
  valueRef: (node: HTMLSpanElement | null) => void;
  tone: string;
}) {
  return (
    <div className="flex min-w-10 flex-col items-center">
      <span className="font-sans text-xs tracking-widest text-muted uppercase">{label}</span>
      <span ref={valueRef} className={`font-display text-3xl leading-none italic tabular-nums ${tone}`}>
        0
      </span>
    </div>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-x-0 bottom-0 flex justify-center px-4 pb-4">
      <div className="w-full max-w-md rounded-2xl border border-line bg-card px-6 py-5">{children}</div>
    </div>
  );
}

function verdict(winner: PhaseSnap["winner"]) {
  if (winner === 0) return "Teal takes it";
  if (winner === 1) return "Ash keeps the pitch";
  return "Shared, this time";
}

function RoundButton({
  label,
  accent,
  onDown,
  onUp,
}: {
  label: string;
  accent?: boolean;
  onDown: () => void;
  onUp?: () => void;
}) {
  return (
    <button
      type="button"
      className={
        accent
          ? "inline-flex size-14 items-center justify-center rounded-full bg-teal font-sans text-sm font-medium text-ivory"
          : "inline-flex size-14 items-center justify-center rounded-full border border-line bg-card font-sans text-sm font-medium text-ink"
      }
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        onDown();
      }}
      onPointerUp={() => onUp?.()}
      onPointerCancel={() => onUp?.()}
    >
      {label}
    </button>
  );
}

function Stick({
  knob,
  onChange,
}: {
  knob: { x: number; y: number };
  onChange: (x: number, y: number, active: boolean) => void;
}) {
  const pad = useRef<HTMLDivElement>(null);
  const radius = 46;

  const move = (clientX: number, clientY: number) => {
    const rect = pad.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const mag = Math.hypot(dx, dy) || 1;
    if (mag > radius) {
      dx = (dx / mag) * radius;
      dy = (dy / mag) * radius;
    }
    onChange(dx / radius, -dy / radius, true);
  };

  return (
    <div
      ref={pad}
      className="relative size-28 touch-none rounded-full border border-line bg-card"
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        move(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
        move(e.clientX, e.clientY);
      }}
      onPointerUp={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
        onChange(0, 0, false);
      }}
      onPointerCancel={() => onChange(0, 0, false)}
      role="application"
      aria-label="Move"
    >
      <span
        className="absolute top-1/2 left-1/2 size-11 rounded-full bg-teal"
        style={{
          transform: `translate(calc(-50% + ${knob.x * radius}px), calc(-50% + ${-knob.y * radius}px))`,
        }}
      />
    </div>
  );
}
