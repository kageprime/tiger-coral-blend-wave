import * as THREE from "three";
import { createAudio } from "./audio";
import { createInput, type InputBus } from "./input";
import {
  BALL_R,
  HALF_L,
  HALF_W,
  GOAL_H,
  GOAL_HW,
  createSim,
  formatClock,
  startMatch,
  step,
  type Axes,
  type Phase,
  type Sim,
} from "./sim";

const INTERNAL_W = 360;
const INTERNAL_H = 270;
const GROUND = 0.09;
const STEP = 1 / 60;

export type PhaseSnap = {
  phase: Phase;
  score: [number, number];
  winner: -1 | 0 | 1 | 2;
  banner: string;
};

export type MountBridge = {
  els: {
    clock: HTMLElement | null;
    scoreA: HTMLElement | null;
    scoreB: HTMLElement | null;
    charge: HTMLElement | null;
    status: HTMLElement | null;
  };
  onSnap: (s: PhaseSnap) => void;
  reducedMotion: boolean;
};

export type MountHandle = {
  input: InputBus;
  start: () => void;
  dispose: () => void;
};

const IVORY = 0xf3efe4;
const INK = 0x2c2824;

export function mount(canvas: HTMLCanvasElement, bridge: MountBridge): MountHandle {
  const audio = createAudio();
  const input = createInput(() => audio.unlock());
  const sim = createSim();
  const reduced = bridge.reducedMotion;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setSize(INTERNAL_W, INTERNAL_H, false);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(IVORY, 1);
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  const aspect = INTERNAL_W / INTERNAL_H;
  const frustum = 7.05;
  const camera = new THREE.OrthographicCamera(
    -frustum * aspect,
    frustum * aspect,
    frustum,
    -frustum,
    0.1,
    90,
  );
  const EL = (28 * Math.PI) / 180;
  const AZ = Math.PI / 4;
  const dist = 34;
  const basePos = new THREE.Vector3(
    Math.cos(EL) * Math.sin(AZ) * dist,
    Math.sin(EL) * dist,
    Math.cos(EL) * Math.cos(AZ) * dist,
  );
  const look = new THREE.Vector3(0, 0.35, 0);
  camera.position.copy(basePos);
  camera.lookAt(look);
  camera.updateMatrixWorld(true);

  const camRight = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const camUp = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  const axes = screenAxes(camera);

  const geos: THREE.BufferGeometry[] = [];
  const mats: Array<THREE.Material | THREE.Texture> = [];
  const g = <T extends THREE.BufferGeometry>(x: T) => {
    geos.push(x);
    return x;
  };
  const m = <T extends THREE.Material>(x: T) => {
    mats.push(x);
    return x;
  };
  const basic = (color: number, extra?: THREE.MeshBasicMaterialParameters) =>
    m(new THREE.MeshBasicMaterial({ color, ...extra }));

  const grassMat = basic(0x5d7c46, { side: THREE.DoubleSide });
  const dirtMat = basic(0xc6a36a, { side: THREE.DoubleSide });
  const pitchMat = basic(0xffffff, {
    map: paintPitch(),
    side: THREE.DoubleSide,
  });
  const boardMat = basic(0x7a5738);
  const postMat = basic(0xf4f1ea);
  const netMat = basic(0x3a342c, { transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide });
  const teal = basic(0x1f8a78);
  const tealDeep = basic(0x146056);
  const ash = basic(0x4a372c);
  const ashDeep = basic(0x2c241e);
  const skin = basic(0xe2b08c);
  const skin2 = basic(0xc99272);
  const hair = basic(INK);
  const ivoryMat = basic(0xf4f1ea);
  const wood = basic(0x8a6240);
  const woodDark = basic(0x5c4030);
  const shadowMat = basic(0x243024, { transparent: true, opacity: 0.28, depthWrite: false });
  const flagMat = basic(0x1f8a78, { side: THREE.DoubleSide });
  const ballMat = basic(0xffffff, { map: ballTexture() });

  // Floating plate — grass overhangs a tan dirt rim. No thick sides.
  const plateShadow = new THREE.Mesh(g(new THREE.CircleGeometry(9.2, 28)), basic(0x3a342c, {
    transparent: true,
    opacity: 0.1,
    depthWrite: false,
  }));
  plateShadow.rotation.x = -Math.PI / 2;
  plateShadow.position.y = -0.14;
  plateShadow.scale.set(1, 0.78, 1);
  scene.add(plateShadow);

  const dirt = new THREE.Mesh(g(blob(9.55, 6.55, 0.085, 1.7)), dirtMat);
  dirt.position.y = 0;
  scene.add(dirt);
  const grass = new THREE.Mesh(g(blob(9.85, 6.75, 0.07, 0.4)), grassMat);
  grass.position.y = 0.05;
  scene.add(grass);

  const pitch = new THREE.Mesh(g(new THREE.PlaneGeometry(HALF_L * 2, HALF_W * 2)), pitchMat);
  pitch.rotation.x = -Math.PI / 2;
  pitch.position.y = GROUND;
  scene.add(pitch);

  scene.add(boards(g, boardMat));
  scene.add(goals(g, postMat, netMat));
  scene.add(props(g, wood, woodDark, teal, ash, ballMat, GROUND));

  const tuft = tufts(g, basic(0x4e6a38), basic(0x86a25c));
  scene.add(tuft.dark, tuft.light);

  const figures: Array<{ root: THREE.Group; legL: THREE.Object3D; legR: THREE.Object3D }> = [];
  const shirts = [teal, tealDeep, tealDeep, ash, ash, ash];
  const shorts = [tealDeep, tealDeep, tealDeep, ashDeep, ashDeep, ashDeep];
  const skins = [skin, skin2, skin, skin2, skin, skin2];
  for (let i = 0; i < 6; i++) {
    const fig = figure(g, shirts[i], shorts[i], skins[i], hair, i < 3 ? ivoryMat : null);
    figures.push(fig);
    scene.add(fig.root);
  }

  const ring = new THREE.Mesh(
    g(new THREE.RingGeometry(0.4, 0.58, 20)),
    basic(0x1f8a78, { transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = GROUND + 0.02;
  scene.add(ring);

  const shadowGeo = g(new THREE.CircleGeometry(0.38, 10));
  const shadows = new THREE.InstancedMesh(shadowGeo, shadowMat, 7);
  shadows.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(shadows);
  const dummy = new THREE.Object3D();

  const ball = new THREE.Mesh(g(new THREE.SphereGeometry(BALL_R, 10, 8)), ballMat);
  scene.add(ball);
  let spinX = 0;
  let spinZ = 0;

  const flags = makeFlags(g, flagMat, hair);
  for (const f of flags) scene.add(f.pivot);

  const dust = makeDust();
  scene.add(dust.points);
  mats.push(dust.points.material as THREE.Material);
  geos.push(dust.points.geometry);
  const motes = makeMotes();
  scene.add(motes.points);
  mats.push(motes.points.material as THREE.Material);
  geos.push(motes.points.geometry);

  let raf = 0;
  let acc = 0;
  let last = performance.now();
  let prevPhase = sim.phase;
  let seenScore: [number, number] = [0, 0];
  let dead = false;

  const emit = () => {
    bridge.onSnap({
      phase: sim.phase,
      score: [sim.score[0], sim.score[1]],
      winner: sim.winner,
      banner: sim.banner,
    });
  };

  const fit = () => {
    const parent = canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const a = INTERNAL_W / INTERNAL_H;
    let cw = rect.width;
    let ch = cw / a;
    if (ch > rect.height) {
      ch = rect.height;
      cw = ch * a;
    }
    canvas.style.width = `${Math.max(1, Math.floor(cw))}px`;
    canvas.style.height = `${Math.max(1, Math.floor(ch))}px`;
  };
  fit();
  const ro = new ResizeObserver(fit);
  if (canvas.parentElement) ro.observe(canvas.parentElement);

  const tmp = new THREE.Vector3();

  const loop = (now: number) => {
    if (dead) return;
    raf = requestAnimationFrame(loop);
    const frameDt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const time = now / 1000;

    acc += frameDt;
    let guard = 0;
    let first = true;
    const frame = input.read();
    while (acc >= STEP && guard < 5) {
      const edge = first ? frame : { ...frame, kickRelease: false, pass: false };
      first = false;
      step(sim, edge, STEP, axes);
      acc -= STEP;
      guard += 1;
    }
    if (guard === 5) acc = 0;

    for (const e of sim.events) {
      if (e.t === "kick") {
        audio.kick(e.hard);
        burst(dust, e.x, e.z, e.hard ? 8 : 4, 0x6e8f52);
      } else if (e.t === "post") {
        audio.post();
      } else if (e.t === "goal") {
        audio.goal();
        audio.whistle();
        burst(dust, e.team === 0 ? HALF_L : -HALF_L, 0, 12, e.team === 0 ? 0x1f8a78 : 0xf4f1ea);
      } else if (e.t === "out") audio.out();
    }
    sim.events.length = 0;

    if (sim.phase !== prevPhase || sim.score[0] !== seenScore[0] || sim.score[1] !== seenScore[1]) {
      prevPhase = sim.phase;
      seenScore = [sim.score[0], sim.score[1]];
      emit();
    }

    const clockEl = bridge.els.clock;
    if (clockEl) clockEl.textContent = formatClock(sim.phase === "title" ? 0 : sim.clock);
    if (bridge.els.scoreA) bridge.els.scoreA.textContent = String(sim.score[0]);
    if (bridge.els.scoreB) bridge.els.scoreB.textContent = String(sim.score[1]);
    if (bridge.els.charge) {
      bridge.els.charge.style.transform = `scaleX(${sim.charge})`;
      const wrap = bridge.els.charge.parentElement;
      if (wrap) wrap.style.opacity = sim.charge > 0.02 ? "1" : "0";
    }
    if (bridge.els.status) {
      bridge.els.status.textContent =
        sim.phase === "play" && sim.kickoff
          ? sim.kickoffTeam === 0
            ? "Your kick"
            : "Their kick"
          : "";
    }

    const mag = reduced ? 0 : sim.trauma * sim.trauma;
    sim.trauma = Math.max(0, sim.trauma - frameDt * 1.55);
    camera.position.copy(basePos);
    if (mag > 0.001) {
      camera.position.addScaledVector(camRight, Math.sin(time * 46) * 0.18 * mag);
      camera.position.addScaledVector(camUp, Math.cos(time * 37) * 0.12 * mag);
    }
    camera.lookAt(look);

    for (let i = 0; i < 6; i++) {
      const p = sim.players[i];
      const fig = figures[i];
      const spd = Math.hypot(p.vx, p.vz);
      const bob =
        sim.phase === "play"
          ? Math.abs(Math.sin(p.anim)) * 0.045 * Math.min(1, spd / 3)
          : Math.abs(Math.sin(time * 1.7 + i)) * 0.02;
      fig.root.position.set(p.x, GROUND + bob, p.z);
      fig.root.rotation.y = p.facing;
      const stride = Math.sin(p.anim) * Math.min(1, spd / 2.2) * 0.7;
      const kick =
        p.kick > 0 ? Math.sin((1 - p.kick / 0.2) * Math.PI) * 1.15 : 0;
      fig.legL.rotation.x = stride + kick;
      fig.legR.rotation.x = -stride * 0.85;

      dummy.position.set(p.x, GROUND + 0.025, p.z);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      shadows.setMatrixAt(i, dummy.matrix);
    }

    const b = sim.ball;
    ball.position.set(b.x, GROUND + b.y, b.z);
    spinX += b.vz * frameDt * 3.4;
    spinZ -= b.vx * frameDt * 3.4;
    ball.rotation.set(spinX, time * 0.15, spinZ);
    const lift = Math.max(0, b.y - BALL_R);
    const ss = 1 / (1 + lift * 0.9);
    dummy.position.set(b.x, GROUND + 0.03, b.z);
    dummy.rotation.set(-Math.PI / 2, 0, 0);
    dummy.scale.set(ss, ss, ss);
    dummy.updateMatrix();
    shadows.setMatrixAt(6, dummy.matrix);
    shadows.instanceMatrix.needsUpdate = true;

    const you = sim.players[0];
    const pulse = 1 + Math.sin(time * 4) * 0.06;
    ring.position.set(you.x, GROUND + 0.02, you.z);
    ring.scale.setScalar(reduced ? 1 : pulse);
    ring.visible = sim.phase !== "over";

    for (let i = 0; i < flags.length; i++) {
      const f = flags[i];
      f.cloth.rotation.y = Math.sin(time * 3.1 + i * 1.3) * 0.45;
      f.cloth.rotation.z = Math.sin(time * 2.4 + i) * 0.06;
    }

    stepDust(dust, frameDt);
    stepMotes(motes, time);

    renderer.render(scene, camera);

    const probePos = () => {
      const p = sim.players[0];
      tmp.set(p.x, 0.4, p.z).project(camera);
      return { x: p.x, z: p.z, ndcX: tmp.x, ndcY: tmp.y };
    };
    window.__controlsTest = {
      getYaw: () => sim.players[0].facing,
      getSpeed: () => Math.hypot(sim.players[0].vx, sim.players[0].vz),
      setKeys: (codes: string[]) => input.setKeys(codes),
      getPos: probePos,
    };
    window.__pitch = {
      start,
      state: () => ({
        phase: sim.phase,
        score: [sim.score[0], sim.score[1]] as [number, number],
        clock: sim.clock,
        kickoff: sim.kickoff,
        charge: sim.charge,
        ball: { x: b.x, y: b.y, z: b.z },
        you: probePos(),
        axes,
      }),
    };
  };

  function start() {
    audio.unlock();
    startMatch(sim);
    emit();
    audio.whistle();
  }

  raf = requestAnimationFrame(loop);
  emit();

  return {
    input,
    start,
    dispose() {
      dead = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      input.dispose();
      audio.dispose();
      delete window.__controlsTest;
      delete window.__pitch;
      renderer.dispose();
      for (const geo of geos) geo.dispose();
      for (const mat of mats) {
        if (mat instanceof THREE.Material) {
          const mapped = mat as THREE.MeshBasicMaterial;
          mapped.map?.dispose();
          mat.dispose();
        } else if (mat instanceof THREE.Texture) mat.dispose();
      }
    },
  };
}

function screenAxes(camera: THREE.OrthographicCamera): Axes {
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  const o = new THREE.Vector3(0, 0, 0).project(camera);
  const px = new THREE.Vector3(1, 0, 0).project(camera);
  const pz = new THREE.Vector3(0, 0, 1).project(camera);
  let rx = px.x - o.x;
  let rz = pz.x - o.x;
  const rl = Math.hypot(rx, rz) || 1;
  rx /= rl;
  rz /= rl;
  let ux = px.y - o.y;
  let uz = pz.y - o.y;
  const ul = Math.hypot(ux, uz) || 1;
  ux /= ul;
  uz /= ul;
  return { right: { x: rx, z: rz }, up: { x: ux, z: uz } };
}

function blob(rx: number, rz: number, jag: number, phase: number) {
  const s = new THREE.Shape();
  const n = 36;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const w =
      1 +
      jag * Math.sin(3 * a + phase) +
      jag * 0.48 * Math.sin(5 * a + phase * 1.4) +
      jag * 0.22 * Math.sin(8 * a + 0.6);
    const x = Math.cos(a) * rx * w;
    const y = Math.sin(a) * rz * w;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  const geo = new THREE.ShapeGeometry(s, 1);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

function paintPitch() {
  const w = 256;
  const h = 160;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);
  const img = ctx.createImageData(w, h);
  const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const A = [111, 143, 82];
  const B = [126, 156, 92];
  const D = [82, 110, 58];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const stripe = Math.floor(x / 32) % 2 === 0;
      const thresh = bayer[(y % 4) * 4 + (x % 4)] / 16;
      const worn = Math.hypot(x - w / 2, y - h / 2) < 30 && thresh > 0.4;
      const col = worn || thresh > 0.84 ? D : stripe ? A : B;
      const i = (y * w + x) * 4;
      img.data[i] = col[0];
      img.data[i + 1] = col[1];
      img.data[i + 2] = col[2];
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  ctx.fillStyle = "#e6e0d0";
  const skip = (x: number, y: number) => {
    const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return n - Math.floor(n) > 0.8;
  };
  const pix = (x: number, y: number) => {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi < 1 || yi < 1 || xi >= w - 1 || yi >= h - 1) return;
    if (skip(xi, yi)) return;
    ctx.fillRect(xi, yi, 1, 1);
  };
  const stroke = (x0: number, y0: number, x1: number, y1: number) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0;
    for (let i = 0; i <= n; i++) {
      const t = n === 0 ? 0 : i / n;
      pix(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
    }
  };
  stroke(3, 3, w - 4, 3);
  stroke(3, h - 4, w - 4, h - 4);
  stroke(3, 3, 3, h - 4);
  stroke(w - 4, 3, w - 4, h - 4);
  for (let y = 10; y < h - 10; y++) {
    if (Math.floor(y / 11) % 5 === 4) continue;
    pix(w / 2, y);
    pix(w / 2 + 1, y);
  }
  for (let a = 0; a < 56; a++) {
    if (a % 8 === 4) continue;
    const t = (a / 56) * Math.PI * 2;
    pix(w / 2 + Math.cos(t) * 22, h / 2 + Math.sin(t) * 22);
  }
  pix(w / 2, h / 2);
  pix(w / 2 + 1, h / 2);
  const box = (edge: number, sign: number) => {
    const inner = edge + sign * 44;
    const y0 = h / 2 - 48;
    const y1 = h / 2 + 48;
    stroke(edge, y0, inner, y0);
    stroke(edge, y1, inner, y1);
    stroke(inner, y0, inner, y1);
    const sx = edge + sign * 32;
    pix(sx, h / 2);
    pix(sx, h / 2 + 1);
  };
  box(4, 1);
  box(w - 5, -1);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}

function ballTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);
  ctx.fillStyle = "#f4f1ea";
  ctx.fillRect(0, 0, 64, 32);
  ctx.fillStyle = "#2a2622";
  for (const [x, y] of [
    [32, 16],
    [12, 8],
    [52, 9],
    [16, 24],
    [48, 24],
    [32, 5],
  ] as Array<[number, number]>) {
    ctx.beginPath();
    ctx.arc(x, y, 4.2, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}

function boards(g: (x: THREE.BoxGeometry) => THREE.BoxGeometry, mat: THREE.Material) {
  const root = new THREE.Group();
  const h = 0.3;
  const y = GROUND + h / 2;
  const thick = 0.16;
  const sideLen = HALF_L * 2;
  const add = (x: number, z: number, sx: number, sz: number) => {
    const mesh = new THREE.Mesh(g(new THREE.BoxGeometry(sx, h, sz)), mat);
    mesh.position.set(x, y, z);
    root.add(mesh);
  };
  add(0, HALF_W + 0.12, sideLen, thick);
  add(0, -(HALF_W + 0.12), sideLen, thick);
  const endSpan = HALF_W - GOAL_HW;
  const endLen = Math.max(0.4, endSpan - 0.05);
  const endZ = GOAL_HW + 0.08 + endLen / 2;
  for (const dir of [1, -1]) {
    add(dir * (HALF_L + 0.1), endZ, thick, endLen);
    add(dir * (HALF_L + 0.1), -endZ, thick, endLen);
  }
  return root;
}

function goals(g: (x: THREE.BufferGeometry) => THREE.BufferGeometry, post: THREE.Material, net: THREE.Material) {
  const root = new THREE.Group();
  const postGeo = g(new THREE.CylinderGeometry(0.055, 0.055, GOAL_H, 6));
  const barGeo = g(new THREE.CylinderGeometry(0.05, 0.05, GOAL_HW * 2, 6));
  for (const dir of [1, -1] as const) {
    const x = dir * HALF_L;
    for (const gz of [GOAL_HW, -GOAL_HW]) {
      const p = new THREE.Mesh(postGeo, post);
      p.position.set(x, GROUND + GOAL_H / 2, gz);
      root.add(p);
    }
    const bar = new THREE.Mesh(barGeo, post);
    bar.rotation.x = Math.PI / 2;
    bar.position.set(x, GROUND + GOAL_H, 0);
    root.add(bar);
    const back = new THREE.Mesh(g(new THREE.PlaneGeometry(GOAL_HW * 2, GOAL_H)), net);
    back.position.set(x + dir * 0.62, GROUND + GOAL_H / 2, 0);
    back.rotation.y = dir === 1 ? Math.PI / 2 : -Math.PI / 2;
    root.add(back);
  }
  return root;
}

function props(
  g: (x: THREE.BufferGeometry) => THREE.BufferGeometry,
  wood: THREE.Material,
  woodDark: THREE.Material,
  teal: THREE.Material,
  ash: THREE.Material,
  ballMat: THREE.Material,
  ground: number,
) {
  const root = new THREE.Group();
  const seat = new THREE.Mesh(g(new THREE.BoxGeometry(1.5, 0.08, 0.38)), wood);
  seat.position.set(-2.3, ground + 0.42, 5.15);
  const back = new THREE.Mesh(g(new THREE.BoxGeometry(1.5, 0.36, 0.06)), woodDark);
  back.position.set(-2.3, ground + 0.64, 5.32);
  root.add(seat, back);
  for (const x of [-2.85, -1.75]) {
    const leg = new THREE.Mesh(g(new THREE.BoxGeometry(0.08, 0.4, 0.08)), woodDark);
    leg.position.set(x, ground + 0.2, 5.15);
    root.add(leg);
  }
  const bag = new THREE.Mesh(g(new THREE.BoxGeometry(0.32, 0.22, 0.2)), ash);
  bag.position.set(-1.35, ground + 0.12, 4.85);
  root.add(bag);
  const bottleA = new THREE.Mesh(g(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 6)), teal);
  bottleA.position.set(-3.15, ground + 0.14, 4.9);
  const bottleB = new THREE.Mesh(g(new THREE.CylinderGeometry(0.05, 0.05, 0.2, 6)), wood);
  bottleB.position.set(-3.28, ground + 0.13, 4.78);
  const spare = new THREE.Mesh(g(new THREE.SphereGeometry(BALL_R * 0.92, 8, 6)), ballMat);
  spare.position.set(3.4, ground + BALL_R, 5.05);
  root.add(bottleA, bottleB, spare);
  return root;
}

function tufts(g: (x: THREE.BufferGeometry) => THREE.BufferGeometry, dark: THREE.Material, light: THREE.Material) {
  const geo = g(new THREE.ConeGeometry(0.09, 0.38, 4));
  const darkSlots: THREE.Matrix4[] = [];
  const lightSlots: THREE.Matrix4[] = [];
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 70; i++) {
    const ang = (i / 70) * Math.PI * 2;
    const rx = 7.7 + (i % 5) * 0.26;
    const rz = 5.25 + (i % 4) * 0.18;
    const x = Math.cos(ang) * rx;
    const z = Math.sin(ang) * rz;
    if (Math.abs(x) < HALF_L + 0.5 && Math.abs(z) < HALF_W + 0.5) continue;
    if (Math.hypot(x / 9.4, z / 6.4) > 1) continue;
    dummy.position.set(x, GROUND + 0.18, z);
    dummy.scale.set(0.75 + (i % 3) * 0.28, 0.55 + (i % 5) * 0.2, 0.8);
    dummy.rotation.y = ang;
    dummy.updateMatrix();
    if (i % 4 === 0) lightSlots.push(dummy.matrix.clone());
    else darkSlots.push(dummy.matrix.clone());
  }
  const a = new THREE.InstancedMesh(geo, dark, Math.max(1, darkSlots.length));
  const b = new THREE.InstancedMesh(geo, light, Math.max(1, lightSlots.length));
  darkSlots.forEach((matrix, i) => a.setMatrixAt(i, matrix));
  lightSlots.forEach((matrix, i) => b.setMatrixAt(i, matrix));
  a.count = darkSlots.length;
  b.count = lightSlots.length;
  return { dark: a, light: b };
}

function figure(
  g: (x: THREE.BufferGeometry) => THREE.BufferGeometry,
  shirt: THREE.Material,
  shorts: THREE.Material,
  skinMat: THREE.Material,
  hairMat: THREE.Material,
  band: THREE.Material | null,
) {
  const root = new THREE.Group();
  const legGeo = g(new THREE.BoxGeometry(0.15, 0.5, 0.17));
  const bootGeo = g(new THREE.BoxGeometry(0.16, 0.1, 0.2));
  const makeLeg = (x: number, name: string) => {
    const pivot = new THREE.Group();
    pivot.name = name;
    pivot.position.set(x, 0.58, 0);
    const thigh = new THREE.Mesh(legGeo, shorts);
    thigh.position.y = -0.25;
    const boot = new THREE.Mesh(bootGeo, hairMat);
    boot.position.set(0, -0.5, 0.02);
    pivot.add(thigh, boot);
    return pivot;
  };
  const legL = makeLeg(-0.11, "legL");
  const legR = makeLeg(0.11, "legR");
  const torso = new THREE.Mesh(g(new THREE.BoxGeometry(0.46, 0.44, 0.28)), shirt);
  torso.position.y = 0.88;
  const head = new THREE.Mesh(g(new THREE.SphereGeometry(0.16, 8, 6)), skinMat);
  head.position.y = 1.26;
  const cap = new THREE.Mesh(g(new THREE.SphereGeometry(0.11, 6, 5)), hairMat);
  cap.position.y = 1.36;
  cap.scale.set(1.15, 0.5, 1.05);
  root.add(legL, legR, torso, head, cap);
  if (band) {
    const stripe = new THREE.Mesh(g(new THREE.BoxGeometry(0.48, 0.07, 0.3)), band);
    stripe.position.y = 1.02;
    root.add(stripe);
  }
  root.scale.setScalar(1.08);
  return { root, legL, legR };
}

function makeFlags(g: (x: THREE.BufferGeometry) => THREE.BufferGeometry, clothMat: THREE.Material, poleMat: THREE.Material) {
  const flags: Array<{ pivot: THREE.Group; cloth: THREE.Object3D }> = [];
  const spots = [
    [HALF_L - 0.15, HALF_W - 0.15],
    [-(HALF_L - 0.15), HALF_W - 0.15],
    [HALF_L - 0.15, -(HALF_W - 0.15)],
    [-(HALF_L - 0.15), -(HALF_W - 0.15)],
  ];
  const poleGeo = g(new THREE.CylinderGeometry(0.025, 0.03, 1.15, 5));
  const clothGeo = g(new THREE.PlaneGeometry(0.42, 0.24));
  clothGeo.translate(0.21, 0, 0);
  for (const [x, z] of spots) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0, z);
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = GROUND + 0.58;
    const cloth = new THREE.Mesh(clothGeo, clothMat);
    cloth.position.set(0, GROUND + 1.02, 0);
    pivot.add(pole, cloth);
    flags.push({ pivot, cloth });
  }
  return flags;
}

type Dust = {
  points: THREE.Points;
  life: Float32Array;
  vel: Float32Array;
};

function makeDust(): Dust {
  const n = 28;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) pos[i * 3 + 1] = -8;
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xc6a36a,
    size: 3.2,
    sizeAttenuation: false,
  });
  return {
    points: new THREE.Points(geo, mat),
    life: new Float32Array(n),
    vel: new Float32Array(n * 3),
  };
}

function burst(dust: Dust, x: number, z: number, count: number, _color: number) {
  const pos = dust.points.geometry.getAttribute("position") as THREE.BufferAttribute;
  let spawned = 0;
  for (let i = 0; i < dust.life.length && spawned < count; i++) {
    if (dust.life[i] > 0) continue;
    dust.life[i] = 0.35 + Math.random() * 0.25;
    pos.setXYZ(i, x + (Math.random() - 0.5) * 0.4, GROUND + 0.15, z + (Math.random() - 0.5) * 0.4);
    dust.vel[i * 3] = (Math.random() - 0.5) * 1.4;
    dust.vel[i * 3 + 1] = 0.8 + Math.random() * 1.4;
    dust.vel[i * 3 + 2] = (Math.random() - 0.5) * 1.4;
    spawned += 1;
  }
  pos.needsUpdate = true;
}

function stepDust(dust: Dust, dt: number) {
  const pos = dust.points.geometry.getAttribute("position") as THREE.BufferAttribute;
  let dirty = false;
  for (let i = 0; i < dust.life.length; i++) {
    if (dust.life[i] <= 0) continue;
    dust.life[i] -= dt;
    dirty = true;
    if (dust.life[i] <= 0) {
      pos.setY(i, -8);
      continue;
    }
    const x = pos.getX(i) + dust.vel[i * 3] * dt;
    const y = pos.getY(i) + dust.vel[i * 3 + 1] * dt;
    const z = pos.getZ(i) + dust.vel[i * 3 + 2] * dt;
    dust.vel[i * 3 + 1] -= 4 * dt;
    pos.setXYZ(i, x, y, z);
  }
  if (dirty) pos.needsUpdate = true;
}

function makeMotes() {
  const n = 14;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const mat = new THREE.PointsMaterial({
    color: 0xe6dcc4,
    size: 2.2,
    sizeAttenuation: false,
  });
  return { points: new THREE.Points(geo, mat), n };
}

function stepMotes(motes: { points: THREE.Points; n: number }, time: number) {
  const pos = motes.points.geometry.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < motes.n; i++) {
    const a = time * 0.18 + i * 0.7;
    pos.setXYZ(
      i,
      Math.sin(a) * (4.2 + (i % 3)),
      0.7 + (i % 4) * 0.28 + Math.sin(time * 0.8 + i) * 0.15,
      Math.cos(a * 0.8 + i) * 3.1,
    );
  }
  pos.needsUpdate = true;
}

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      setKeys: (codes: string[]) => void;
      getPos: () => { x: number; z: number; ndcX: number; ndcY: number };
    };
    __pitch?: {
      start: () => void;
      state: () => {
        phase: string;
        score: [number, number];
        clock: number;
        kickoff: boolean;
        charge: number;
        ball: { x: number; y: number; z: number };
        you: { x: number; z: number; ndcX: number; ndcY: number };
        axes: Axes;
      };
    };
  }
}
