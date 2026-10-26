/** Five-a-side on a 12.8m × 8m cage. Metres, +Y up, team 0 attacks +X. */

export const HALF_L = 6.4;
export const HALF_W = 4;
export const GOAL_HW = 1.32;
export const GOAL_H = 1.38;
export const BALL_R = 0.22;
export const MATCH_SECS = 70;
export const WIN_GOALS = 3;
const BOARD_H = 0.86;
const CTRL_R = 0.86;
const SEP = 0.68;

export type Team = 0 | 1;
export type Role = "you" | "mate" | "opp";
export type Phase = "title" | "play" | "goal" | "over";

export type Player = {
  id: number;
  team: Team;
  role: Role;
  x: number;
  z: number;
  vx: number;
  vz: number;
  facing: number;
  anim: number;
  kick: number;
  cool: number;
  homeX: number;
  homeZ: number;
};

export type Ball = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
};

export type GameEvent =
  | { t: "kick"; hard: boolean; x: number; z: number }
  | { t: "post"; x: number; z: number }
  | { t: "goal"; team: Team }
  | { t: "out" };

export type Sim = {
  phase: Phase;
  clock: number;
  score: [number, number];
  ball: Ball;
  players: Player[];
  kickLock: number;
  kickoff: boolean;
  kickoffTeam: Team;
  lastTouch: Team;
  scorer: Team;
  goalPause: number;
  hitstop: number;
  trauma: number;
  charge: number;
  possessor: number;
  hold: number;
  receiveLock: number;
  receiveTeam: Team;
  banner: string;
  winner: -1 | 0 | 1 | 2;
  events: GameEvent[];
};

export type Axes = {
  right: { x: number; z: number };
  up: { x: number; z: number };
};

export type FrameInput = {
  sx: number;
  sy: number;
  kickHeld: boolean;
  kickRelease: boolean;
  pass: boolean;
};

const ROSTER: Array<Pick<Player, "id" | "team" | "role" | "homeX" | "homeZ">> = [
  { id: 0, team: 0, role: "you", homeX: -1.5, homeZ: 0 },
  { id: 1, team: 0, role: "mate", homeX: -3.9, homeZ: -1.85 },
  { id: 2, team: 0, role: "mate", homeX: -3.3, homeZ: 2.05 },
  { id: 3, team: 1, role: "opp", homeX: 2.7, homeZ: 0.15 },
  { id: 4, team: 1, role: "opp", homeX: 4.9, homeZ: -1.75 },
  { id: 5, team: 1, role: "opp", homeX: 4.55, homeZ: 1.95 },
];

export function createSim(): Sim {
  const players: Player[] = ROSTER.map((r) => ({
    ...r,
    x: r.homeX,
    z: r.homeZ,
    vx: 0,
    vz: 0,
    facing: r.team === 0 ? Math.PI / 2 : -Math.PI / 2,
    anim: r.id * 0.7,
    kick: 0,
    cool: 0,
  }));
  return {
    phase: "title",
    clock: 0,
    score: [0, 0],
    ball: { x: 0, y: BALL_R, z: 0, vx: 0, vy: 0, vz: 0 },
    players,
    kickLock: 0,
    kickoff: false,
    kickoffTeam: 0,
    lastTouch: 0,
    scorer: 0,
    goalPause: 0,
    hitstop: 0,
    trauma: 0,
    charge: 0,
    possessor: -1,
    hold: 0,
    receiveLock: 0,
    receiveTeam: 0,
    banner: "",
    winner: -1,
    events: [],
  };
}

export function startMatch(sim: Sim) {
  sim.score[0] = 0;
  sim.score[1] = 0;
  sim.clock = 0;
  sim.winner = -1;
  sim.banner = "";
  sim.phase = "play";
  sim.trauma = 0;
  sim.charge = 0;
  sim.hitstop = 0;
  sim.events.length = 0;
  resetKickoff(sim, 0);
}

export function resetKickoff(sim: Sim, team: Team) {
  sim.kickoff = true;
  sim.kickoffTeam = team;
  sim.kickLock = 0.12;
  sim.possessor = -1;
  sim.charge = 0;
  sim.hold = 0;
  sim.receiveLock = 0;
  const b = sim.ball;
  b.x = 0;
  b.y = BALL_R;
  b.z = 0;
  b.vx = 0;
  b.vy = 0;
  b.vz = 0;
  for (const p of sim.players) {
    const s = kickoffSpot(p, team);
    p.x = s.x;
    p.z = s.z;
    p.vx = 0;
    p.vz = 0;
    p.kick = 0;
    p.facing = p.team === 0 ? Math.PI / 2 : -Math.PI / 2;
  }
}

function kickoffSpot(p: Player, team: Team) {
  if (team === 0) {
    if (p.id === 0) return { x: -1.02, z: 0.05 };
    if (p.team === 1) return { x: Math.max(p.homeX, 2.15), z: p.homeZ };
    return { x: p.homeX, z: p.homeZ };
  }
  if (p.id === 3) return { x: 1.02, z: -0.05 };
  if (p.team === 0) return { x: Math.min(p.homeX, -2.15), z: p.homeZ };
  return { x: p.homeX, z: p.homeZ };
}

export function formatClock(elapsed: number) {
  const s = Math.max(0, Math.ceil(MATCH_SECS - elapsed));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function dampAngle(cur: number, target: number, dt: number, k: number) {
  let d = target - cur;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return cur + d * (1 - Math.exp(-k * dt));
}

function maxSpeed(p: Player) {
  if (p.role === "you") return 5.15;
  if (p.id === 3) return 4.55;
  if (p.role === "mate") return 4.25;
  return 4.05;
}

function addTrauma(sim: Sim, amount: number) {
  sim.trauma = Math.min(1, Math.max(sim.trauma, amount));
}

function launch(
  sim: Sim,
  p: Player,
  dirX: number,
  dirZ: number,
  power: number,
  loft: number,
) {
  const len = Math.hypot(dirX, dirZ) || 1;
  const nx = dirX / len;
  const nz = dirZ / len;
  const b = sim.ball;
  b.x = p.x + nx * 0.64;
  b.z = p.z + nz * 0.64;
  b.y = BALL_R + 0.04;
  const spd = Math.min(22, power);
  b.vx = nx * spd;
  b.vz = nz * spd;
  b.vy = loft;
  sim.kickLock = 0.26;
  sim.lastTouch = p.team;
  sim.possessor = -1;
  sim.kickoff = false;
  sim.receiveLock = 0;
  p.cool = 0.32;
  p.kick = 0.2;
  p.facing = Math.atan2(nx, nz);
  const hard = power >= 14.2;
  addTrauma(sim, hard ? 0.42 : 0.18);
  sim.hitstop = hard ? 0.045 : 0.02;
  sim.events.push({ t: "kick", hard, x: b.x, z: b.z });
}

function finish(sim: Sim) {
  sim.phase = "over";
  sim.banner = "";
  sim.kickoff = false;
  if (sim.score[0] > sim.score[1]) sim.winner = 0;
  else if (sim.score[1] > sim.score[0]) sim.winner = 1;
  else sim.winner = 2;
}

function scoreGoal(sim: Sim, team: Team) {
  if (sim.phase !== "play") return;
  sim.score[team] += 1;
  sim.phase = "goal";
  sim.scorer = team;
  sim.goalPause = 1.35;
  sim.hitstop = 0.08;
  addTrauma(sim, 0.78);
  sim.banner = "Goal";
  sim.kickoff = false;
  sim.possessor = -1;
  const b = sim.ball;
  b.vx = 0;
  b.vy = 0;
  b.vz = 0;
  b.x = team === 0 ? HALF_L + 0.38 : -HALF_L - 0.38;
  b.y = Math.min(Math.max(b.y, BALL_R), 1.05);
  b.z = clamp(b.z, -GOAL_HW + 0.2, GOAL_HW - 0.2);
  sim.events.push({ t: "goal", team });
}

function outOfPlay(sim: Sim) {
  const receiver: Team = sim.lastTouch === 0 ? 1 : 0;
  const b = sim.ball;
  b.vx = 0;
  b.vy = 0;
  b.vz = 0;
  b.y = BALL_R;
  b.x = clamp(b.x, -HALF_L + 1.15, HALF_L - 1.15);
  b.z = clamp(b.z, -HALF_W + 0.55, HALF_W - 0.55);
  sim.kickLock = 0.3;
  sim.possessor = -1;
  sim.receiveLock = 0.85;
  sim.receiveTeam = receiver;
  sim.kickoff = false;
  sim.events.push({ t: "out" });
}

function pickChaser(sim: Sim, team: Team): Player {
  const slow =
    sim.possessor >= 0 &&
    sim.players[sim.possessor].team === team &&
    Math.hypot(sim.ball.vx, sim.ball.vz) < 11 &&
    sim.ball.y < 0.75;
  if (slow) return sim.players[sim.possessor];
  let best = sim.players[0];
  let bestD = 1e9;
  for (const p of sim.players) {
    if (p.team !== team) continue;
    let d = Math.hypot(p.x - sim.ball.x, p.z - sim.ball.z);
    if (p.id === 3 || p.id === 1) d *= 0.8;
    if (p.role === "you") d *= 0.72;
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

function formation(p: Player, sim: Sim, push: number) {
  let x = p.homeX + sim.ball.x * 0.32 + push;
  const z = clamp(p.homeZ + sim.ball.z * 0.14, -HALF_W + 0.45, HALF_W - 0.45);
  if (p.team === 0) x = clamp(x, -HALF_L + 0.55, HALF_L - 1.3);
  else x = clamp(x, -HALF_L + 1.3, HALF_L - 0.55);
  return { x, z };
}

function targetFor(p: Player, sim: Sim) {
  const attack = p.team === 0 ? 1 : -1;
  if (sim.kickoff) {
    const kicker =
      (sim.kickoffTeam === 0 && p.role === "you") ||
      (sim.kickoffTeam === 1 && p.id === 3);
    if (kicker && p.team === sim.kickoffTeam) return { x: 0, z: 0 };
    const spot = kickoffSpot(p, sim.kickoffTeam);
    return spot;
  }
  const chaser = pickChaser(sim, p.team);
  const owner = sim.possessor >= 0 ? sim.players[sim.possessor] : null;
  const weHave = !!owner && owner.team === p.team && sim.ball.y < 0.8;
  if (p === chaser && !(weHave && owner !== p)) {
    return { x: sim.ball.x - attack * 0.42, z: sim.ball.z };
  }
  if (!weHave && p.team === 1 && p !== chaser) {
    const you = sim.players[0];
    const base = formation(p, sim, 0);
    return {
      x: clamp(base.x * 0.62 + you.x * 0.38, -HALF_L + 0.5, HALF_L - 0.5),
      z: clamp(base.z * 0.5 + you.z * 0.5, -HALF_W + 0.4, HALF_W - 0.4),
    };
  }
  const push = weHave && owner !== p ? attack * 1.25 : 0;
  return formation(p, sim, push);
}

function nearestMate(sim: Sim, p: Player) {
  const attack = p.team === 0 ? 1 : -1;
  let best: Player | null = null;
  let bestScore = -1e9;
  for (const o of sim.players) {
    if (o.team !== p.team || o.id === p.id) continue;
    let open = 99;
    for (const q of sim.players) {
      if (q.team === p.team) continue;
      open = Math.min(open, Math.hypot(q.x - o.x, q.z - o.z));
    }
    const ahead = (o.x - p.x) * attack;
    let score = open * 1.25 + ahead * 0.85 - Math.hypot(o.x - p.x, o.z - p.z) * 0.12;
    if (o.role === "you" && sim.hold > 0.7) score += 3.2;
    if (score > bestScore) {
      bestScore = score;
      best = o;
    }
  }
  return best;
}

function findController(sim: Sim): Player | null {
  if (sim.kickLock > 0 || sim.kickoff) return null;
  const b = sim.ball;
  if (b.y > 0.78) return null;
  if (Math.hypot(b.vx, b.vz) > 12) return null;
  const allow = (p: Player) => sim.receiveLock <= 0 || p.team === sim.receiveTeam;
  if (sim.possessor >= 0) {
    const cur = sim.players[sim.possessor];
    const d = Math.hypot(cur.x - b.x, cur.z - b.z);
    if (allow(cur) && d < 0.98 && b.y < 0.62) {
      let challenger: Player | null = null;
      let cd = d - 0.06;
      for (const p of sim.players) {
        if (p.id === cur.id || !allow(p)) continue;
        const pd = Math.hypot(p.x - b.x, p.z - b.z);
        if (pd < cd) {
          cd = pd;
          challenger = p;
        }
      }
      return challenger ?? cur;
    }
  }
  let best: Player | null = null;
  let bestD = CTRL_R;
  for (const p of sim.players) {
    if (!allow(p)) continue;
    const d = Math.hypot(p.x - b.x, p.z - b.z);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

function dribble(sim: Sim, p: Player, dt: number) {
  const fx = Math.sin(p.facing);
  const fz = Math.cos(p.facing);
  const tx = p.x + fx * 0.56;
  const tz = p.z + fz * 0.56;
  const b = sim.ball;
  const k = 1 - Math.exp(-18 * dt);
  b.x += (tx - b.x) * k;
  b.z += (tz - b.z) * k;
  b.y = BALL_R;
  b.vy = 0;
  b.vx = p.vx;
  b.vz = p.vz;
  sim.possessor = p.id;
  sim.lastTouch = p.team;
}

function humanShot(sim: Sim, p: Player, charge: number) {
  const gx = HALF_L - 0.15;
  const gz = clamp(sim.ball.z * 0.22, -1.0, 1.0);
  const ax = gx - sim.ball.x;
  const az = gz - sim.ball.z;
  const al = Math.hypot(ax, az) || 1;
  const fx = Math.sin(p.facing);
  const fz = Math.cos(p.facing);
  const c = clamp(charge, 0, 1);
  launch(
    sim,
    p,
    (ax / al) * 0.78 + fx * 0.22,
    (az / al) * 0.78 + fz * 0.22,
    13.4 + c * 6,
    0.65 + c * 2.5,
  );
}

function humanTap(sim: Sim, p: Player) {
  const fx = Math.sin(p.facing);
  const fz = Math.cos(p.facing);
  let dx = fx;
  let dz = fz;
  let power = 12.2;
  let loft = 0.5;
  if (p.x > 0.4 && fx > 0.15) {
    const ax = HALF_L - 0.15 - sim.ball.x;
    const az = clamp(sim.ball.z * 0.18, -0.85, 0.85) - sim.ball.z;
    const al = Math.hypot(ax, az) || 1;
    dx = fx * 0.4 + (ax / al) * 0.6;
    dz = fz * 0.4 + (az / al) * 0.6;
    if (p.x > 1.6) {
      power = 14.6;
      loft = 0.7;
    }
  }
  launch(sim, p, dx, dz, power, loft);
}

function aiAct(sim: Sim, p: Player) {
  if (p.cool > 0) return;
  const attack = p.team === 0 ? 1 : -1;
  const goalX = attack * (HALF_L - 0.2);
  const along = Math.abs(goalX - p.x);
  const shooting = along < 5.1 && Math.abs(p.z) < 1.85 && Math.abs(p.x) > 0.8;
  if (shooting) {
    const zErr = (Math.random() - 0.5) * 1.05;
    launch(sim, p, goalX - sim.ball.x, zErr - sim.ball.z, 15.1, 1.25);
    return;
  }
  let nearestOpp = 99;
  for (const o of sim.players) {
    if (o.team === p.team) continue;
    nearestOpp = Math.min(nearestOpp, Math.hypot(o.x - p.x, o.z - p.z));
  }
  const threatened = nearestOpp < 1.65;
  const holdPass = p.team === 0 && p.role !== "you" && sim.hold > 1.05;
  if (threatened || holdPass) {
    const mate = nearestMate(sim, p);
    if (mate) {
      const tx = mate.x + mate.vx * 0.22;
      const tz = mate.z + mate.vz * 0.22;
      launch(sim, p, tx - sim.ball.x, tz - sim.ball.z, 10.4, 1.65);
    }
  }
}

function integrateBall(sim: Sim, dt: number) {
  const b = sim.ball;
  const prevX = b.x;
  const prevY = b.y;
  const prevZ = b.z;
  b.vy -= 9.81 * dt;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.z += b.vz * dt;

  if (b.y <= BALL_R) {
    const impact = b.vy;
    b.y = BALL_R;
    if (impact < 0) {
      b.vy = Math.abs(impact) < 1.25 ? 0 : -impact * 0.48;
      if (impact < -3.2) sim.events.push({ t: "post", x: b.x, z: b.z });
    }
    const sp = Math.hypot(b.vx, b.vz);
    if (sp > 0) {
      const drop = Math.min(sp, 6.4 * dt);
      b.vx -= (b.vx / sp) * drop;
      b.vz -= (b.vz / sp) * drop;
    }
  } else {
    const drag = Math.exp(-0.18 * dt);
    b.vx *= drag;
    b.vz *= drag;
  }
  if (Math.hypot(b.vx, b.vz) < 0.12 && b.y <= BALL_R + 0.001) {
    b.vx = 0;
    b.vz = 0;
  }

  // Goal mouths — interpolate the crossing so a fast shot can't skip the line.
  for (const dir of [1, -1] as const) {
    const line = dir * HALF_L;
    const crossed = dir === 1 ? prevX <= line && b.x > line : prevX >= line && b.x < line;
    if (!crossed) continue;
    const span = b.x - prevX || 0.0001;
    const t = clamp((line - prevX) / span, 0, 1);
    const cz = prevZ + (b.z - prevZ) * t;
    const cy = prevY + (b.y - prevY) * t;
    if (Math.abs(cz) <= GOAL_HW - 0.05 && cy <= GOAL_H - 0.02 && cy >= 0) {
      b.z = cz;
      b.y = cy;
      scoreGoal(sim, dir === 1 ? 0 : 1);
      return;
    }
  }
  if (sim.phase !== "play") return;

  bounceEnds(sim, prevX, prevY);
  if (sim.phase !== "play") return;
  bounceSides(sim);
  bouncePosts(sim);

  if (b.y > 8 || Math.abs(b.x) > HALF_L + 3 || Math.abs(b.z) > HALF_W + 3) {
    outOfPlay(sim);
  }
}

function bounceSides(sim: Sim) {
  const b = sim.ball;
  const limit = HALF_W - BALL_R;
  if (b.z > limit) {
    if (b.y <= BOARD_H) {
      b.z = limit;
      b.vz = -Math.abs(b.vz) * 0.62;
    } else if (b.z > HALF_W + 0.45) outOfPlay(sim);
  } else if (b.z < -limit) {
    if (b.y <= BOARD_H) {
      b.z = -limit;
      b.vz = Math.abs(b.vz) * 0.62;
    } else if (b.z < -HALF_W - 0.45) outOfPlay(sim);
  }
}

function bounceEnds(sim: Sim, prevX: number, prevY: number) {
  const b = sim.ball;
  const limit = HALF_L - BALL_R;
  const trySide = (dir: 1 | -1) => {
    const beyond = dir === 1 ? b.x > limit : b.x < -limit;
    if (!beyond) return;
    const line = dir * HALF_L;
    const span = b.x - prevX || 0.0001;
    const t = clamp((line - prevX) / span, 0, 1);
    const cy = prevY + (b.y - prevY) * t;
    const inPosts = Math.abs(b.z) <= GOAL_HW + 0.05;
    const bar =
      inPosts && cy >= GOAL_H - 0.08 && cy <= GOAL_H + 0.22 && b.y < GOAL_H + 0.35;
    if (bar) {
      b.x = dir * limit;
      b.vx = -dir * Math.abs(b.vx) * 0.5;
      b.vy = Math.abs(b.vy) * 0.25 + 1.4;
      addTrauma(sim, 0.28);
      sim.events.push({ t: "post", x: b.x, z: b.z });
      return;
    }
    if (b.y <= BOARD_H || (inPosts && b.y < GOAL_H)) {
      // Low ball into the end boards, or into the frame beside / under a miss.
      if (!(inPosts && b.y < GOAL_H - 0.02)) {
        b.x = dir * limit;
        b.vx = -dir * Math.abs(b.vx) * 0.62;
        return;
      }
    }
    if ((dir === 1 && b.x > HALF_L + 0.5) || (dir === -1 && b.x < -HALF_L - 0.5)) {
      outOfPlay(sim);
    }
  };
  trySide(1);
  if (sim.phase === "play") trySide(-1);
}

function bouncePosts(sim: Sim) {
  const b = sim.ball;
  if (b.y > GOAL_H) return;
  for (const dir of [1, -1] as const) {
    for (const gz of [GOAL_HW, -GOAL_HW]) {
      const px = dir * HALF_L;
      const dx = b.x - px;
      const dz = b.z - gz;
      const d = Math.hypot(dx, dz);
      const min = BALL_R + 0.07;
      if (d < min && d > 1e-5) {
        const nx = dx / d;
        const nz = dz / d;
        b.x = px + nx * min;
        b.z = gz + nz * min;
        const vn = b.vx * nx + b.vz * nz;
        if (vn < 0) {
          b.vx -= 1.55 * vn * nx;
          b.vz -= 1.55 * vn * nz;
          addTrauma(sim, 0.22);
          sim.events.push({ t: "post", x: b.x, z: b.z });
        }
      }
    }
  }
}

function movePlayer(p: Player, tx: number, tz: number, dt: number, speedMul: number) {
  const dx = tx - p.x;
  const dz = tz - p.z;
  const d = Math.hypot(dx, dz);
  const sp = d < 0.22 ? 0 : maxSpeed(p) * speedMul;
  const dirx = d < 0.22 ? 0 : dx / d;
  const dirz = d < 0.22 ? 0 : dz / d;
  const k = 1 - Math.exp(-11 * dt);
  p.vx += (dirx * sp - p.vx) * k;
  p.vz += (dirz * sp - p.vz) * k;
  p.x += p.vx * dt;
  p.z += p.vz * dt;
  const spd = Math.hypot(p.vx, p.vz);
  if (spd > 0.35) p.facing = dampAngle(p.facing, Math.atan2(p.vx, p.vz), dt, 14);
  p.anim += spd * dt * 2.15;
}

export function step(sim: Sim, input: FrameInput, dt: number, axes: Axes) {
  if (sim.hitstop > 0) {
    sim.hitstop = Math.max(0, sim.hitstop - dt);
    return;
  }
  if (sim.phase === "goal") {
    sim.goalPause -= dt;
    if (sim.goalPause <= 0) {
      if (
        sim.score[0] >= WIN_GOALS ||
        sim.score[1] >= WIN_GOALS ||
        sim.clock >= MATCH_SECS
      ) {
        finish(sim);
      } else {
        resetKickoff(sim, sim.scorer === 0 ? 1 : 0);
        sim.phase = "play";
        sim.banner = "";
      }
    }
    return;
  }
  if (sim.phase !== "play") return;

  sim.clock += dt;
  if (sim.clock >= MATCH_SECS) {
    finish(sim);
    return;
  }

  if (sim.kickLock > 0) sim.kickLock = Math.max(0, sim.kickLock - dt);
  if (sim.receiveLock > 0) sim.receiveLock = Math.max(0, sim.receiveLock - dt);

  const you = sim.players[0];
  const wx = input.sx * axes.right.x + input.sy * axes.up.x;
  const wz = input.sx * axes.right.z + input.sy * axes.up.z;

  for (const p of sim.players) {
    if (p.cool > 0) p.cool = Math.max(0, p.cool - dt);
    if (p.kick > 0) p.kick = Math.max(0, p.kick - dt);
    if (p.role === "you") {
      const k = 1 - Math.exp(-14 * dt);
      const sp = maxSpeed(p);
      p.vx += (wx * sp - p.vx) * k;
      p.vz += (wz * sp - p.vz) * k;
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      const spd = Math.hypot(p.vx, p.vz);
      if (spd > 0.3) p.facing = dampAngle(p.facing, Math.atan2(p.vx, p.vz), dt, 16);
      p.anim += spd * dt * 2.15;
    } else {
      const tgt = targetFor(p, sim);
      movePlayer(p, tgt.x, tgt.z, dt, sim.kickoff && p.team !== sim.kickoffTeam ? 0.85 : 1);
    }
  }

  const ps = sim.players;
  for (let i = 0; i < ps.length; i++) {
    for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i];
      const b = ps[j];
      let dx = b.x - a.x;
      let dz = b.z - a.z;
      let dist = Math.hypot(dx, dz);
      if (dist < 0.0001) {
        dx = 0.01;
        dz = 0;
        dist = 0.01;
      }
      if (dist < SEP) {
        const push = (SEP - dist) * 0.5;
        const nx = dx / dist;
        const nz = dz / dist;
        const wa = a.role === "you" ? 0.32 : 0.5;
        const wb = b.role === "you" ? 0.32 : 0.5;
        a.x -= nx * push * wa * 2;
        a.z -= nz * push * wa * 2;
        b.x += nx * push * wb * 2;
        b.z += nz * push * wb * 2;
      }
    }
  }

  for (const p of ps) {
    p.x = clamp(p.x, -HALF_L + 0.26, HALF_L - 0.26);
    p.z = clamp(p.z, -HALF_W + 0.26, HALF_W - 0.26);
    if (sim.kickoff && p.team !== sim.kickoffTeam) {
      if (p.team === 0) p.x = Math.min(p.x, -0.85);
      else p.x = Math.max(p.x, 0.85);
    }
  }

  if (sim.kickoff) {
    const b = sim.ball;
    b.x = 0;
    b.y = BALL_R;
    b.z = 0;
    b.vx = 0;
    b.vy = 0;
    b.vz = 0;
    if (sim.kickoffTeam === 0) {
      const d = Math.hypot(you.x, you.z);
      const moving = Math.hypot(input.sx, input.sy) > 0.2;
      if (d < 0.9 && (input.kickRelease || input.pass || (moving && d < 0.62))) {
        sim.kickoff = false;
        if (input.pass) {
          const mate = nearestMate(sim, you);
          if (mate) launch(sim, you, mate.x - b.x, mate.z - b.z, 10.4, 1.6);
        } else if (input.kickRelease) {
          if (sim.charge > 0.14) humanShot(sim, you, sim.charge);
          else humanTap(sim, you);
          sim.charge = 0;
        }
      } else if (input.kickHeld && d < 1.1) {
        sim.charge = Math.min(1, sim.charge + dt / 0.48);
      } else if (!input.kickHeld) sim.charge = 0;
    } else {
      const kicker = sim.players[3];
      if (Math.hypot(kicker.x, kicker.z) < 0.72 && kicker.cool <= 0) {
        sim.kickoff = false;
        launch(sim, kicker, -1, (Math.random() - 0.5) * 0.4, 11.5, 0.7);
      }
    }
    return;
  }

  const pre = findController(sim);
  if (pre && pre.team === 0 && pre.role !== "you") sim.hold += dt;
  else sim.hold = 0;

  if (pre?.role === "you") {
    if (input.pass) {
      const mate = nearestMate(sim, you);
      if (mate) launch(sim, you, mate.x + mate.vx * 0.2 - sim.ball.x, mate.z + mate.vz * 0.2 - sim.ball.z, 10.6, 1.6);
      else humanTap(sim, you);
      sim.charge = 0;
    } else if (input.kickRelease) {
      if (sim.charge > 0.14) humanShot(sim, you, sim.charge);
      else humanTap(sim, you);
      sim.charge = 0;
    } else if (input.kickHeld) {
      sim.charge = Math.min(1, sim.charge + dt / 0.48);
    } else sim.charge = 0;
  } else {
    sim.charge = 0;
    if (input.kickRelease && (!pre || pre.team === 1)) {
      const d = Math.hypot(you.x - sim.ball.x, you.z - sim.ball.z);
      if (d < 1.08 && sim.ball.y < 1.2 && sim.kickLock <= 0) {
        launch(sim, you, Math.sin(you.facing), Math.cos(you.facing), 12.8, 0.85);
      }
    } else if (pre) {
      aiAct(sim, pre);
    }
  }

  const controller = findController(sim);
  if (controller) dribble(sim, controller, dt);
  else {
    integrateBall(sim, dt);
    if (sim.phase === "play") {
      const now = findController(sim);
      sim.possessor = now ? now.id : -1;
    }
  }
}
