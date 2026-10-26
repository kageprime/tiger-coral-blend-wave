const KEY = "small-pitch-v1";

export type Record = { v: 1; played: number; wins: number; goals: number };

const EMPTY: Record = { v: 1, played: 0, wins: 0, goals: 0 };

export function loadRecord(): Record {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const p = JSON.parse(raw) as Partial<Record>;
    if (p.v !== 1 || typeof p.played !== "number") return { ...EMPTY };
    return {
      v: 1,
      played: p.played,
      wins: typeof p.wins === "number" ? p.wins : 0,
      goals: typeof p.goals === "number" ? p.goals : 0,
    };
  } catch {
    return { ...EMPTY };
  }
}

export function saveResult(score: [number, number], winner: number): Record {
  const r = loadRecord();
  r.played += 1;
  r.goals += score[0];
  if (winner === 0) r.wins += 1;
  localStorage.setItem(KEY, JSON.stringify(r));
  return r;
}
