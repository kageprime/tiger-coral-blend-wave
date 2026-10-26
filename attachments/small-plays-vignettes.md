# "Small plays / Small battles" vignette pipeline

From the thread @awwbhi2 posted 2026-10-25 ("To the 1,000+ people who bookmarked
this video, here's how I made it"), explaining his viral "Small battles -
Pokémon" clip (https://x.com/awwbhi2/status/2112994353627254953), which he made
after seeing @zzzzshawn's "Small plays - Basketball"
(https://x.com/zzzzshawn/status/2111546123546661289). abhi made the whole thing
with Claude Opus 5.5 driving a fixed step-by-step workflow.

## The 5-step recipe (steps 1-4 with Claude + tools, step 5 offline)

1. **Reference** — FFmpeg-extract frames of the style donor's clip and MEASURE
   them. Key measurements: it is a 3D scene drawn small and upscaled ~5x with
   sharp (nearest-neighbour) pixel edges; camera 45deg azimuth, tilted 30deg
   down; ~40 colour palette; flat pastel diorama on a blank background.
2. **Research** — no made-up motion. Study fan wikis for how the creatures
   move/fight; real physics for weight: true gravity, plus impact-stop
   (hitstop) — freeze frames on big hits make them feel heavy.
3. **Build** — a single web page, three.js, NO 3D models (simple primitives
   only), real sizes in metres and real gravity so jumps/falls take physically
   correct time. Pixel look = render tiny framebuffer (~292x292), upscale 5x.
4. **Review** — render key frames to a review board (he used Pen via MCP) and
   nitpick look/feel per frame BEFORE paying for a full render.
5. **Render** — deterministic frame capture: drive the scene in headless
   Chrome and grab one frame at a time (HyperFrames tool in his case).
   Screen recording drops frames; this yields a clean 60fps MP4.

## Shawn's video style rules (distilled frame-by-frame, apply to ALL env builds)
1. **Plate, not block.** Ground is a thin floating slice: irregular organic grass
   silhouette, slight overhang, tan dirt rim. NO thick soil cross-section sides.
2. **2:1 dimetric iso** (~26.5 deg tilt for sprite-art look; abhi's 3D uses 30 deg).
   Camera fixed, 45 deg azimuth.
3. **Worn surfaces.** Base color + dithered/crack variation + hand-set markings;
   one saturated accent color (teal key in his court) as the single focal point.
4. **Restrained palette** (~20-30 colors), unlit uniform ambient + soft blob
   shadows under every object — artwork is flat, shadows carry the grounding.
5. **Ambient population, not choreography**: several tiny actors each doing
   their own thing, loop discipline, pure-physics ball/props with varied timing.
8. **Fishing clip (Oct 18)** — env-dominant: two stacked polar blobs (dark under-blob + light top-blob) with scalloped/dithered rims; slow drifting interior texture patches for life; a corner prop (dock) breaks the blob silhouette outward; ripple rings as kinetic decals. Most applicable reference FOR environment-only plates.
6. **Composition**: props live along the edges (hoop, bench), center stays open
   for motion.
7. Pure white/ivory cutout background, no sides visible.

## User's direction (2026-10-25)
- The reference is for **noting the STYLE first**, not for building a battle
  clip. abhi's subject (Pokémon) is explicitly NOT wanted.
- Build the **environment first** — a small-plays-style diorama of our gothic
  world (terrain platform, props) — BEFORE locking in what type of game the
  project is. No combat scenes, no game design commitments yet.
- The triplet to preserve: style noted -> environment standing on its own ->
  game-type/user decisions come after.


## Env plate v1 shipped (2026-10-25)
- Goethic "small fights" diorama: `vignette/index.html` + `vignette/src/env.js`
  (serve: `pnpm exec vite vignette --port 5174 --strictPort`). Rigid fork of the
  prototype chain: internal 300×280 → outline kernel → OKLab posterise (6
  levels) + Bayer 4×4 dither → canvas 5× nearest (1500×1400).
- Contents: polar-blob grass plate with dirt court (blobGeometry, 85% dirt),
  flagstone field (N=7, TILE=1.55, GAP=0.14), rim clumps, crypt gate with
  **single-outline shape incl. arch as a boundary bight** (shape+hole
  triangulates a notch — don't), *sealed timber door* in the recess (plank
  grooves + iron bands + threshold rubble + dark back panel top 3.0 so bare
  bg never peeks over the door), broken pier, brazier (flame sprite, flicker
  light, embers), bench with backrest, graves, bones, worn-path discs, grass
  intrusions on the dirt annulus, blob shadows, drift motes.
- Seamless loop: LOOP=6s; every motion driven off `u=(t%6/6)*2π` integer

## Summer stall lessons (2026-10-25, tweet 2112328674750132577)
- Fat hero roof ("hat slab"): awning = big straw slab, 2-3x the counter
  footprint, ragged fringe edge, streaky dither; reads as separate object ON
  TOP. Dark void underneath for depth.
- Work-idle loop beats choreography: vendor does ONE small repeated action
  (cloth wipe, ~12-15 frames, arms cycle). Life source for populated scenes.
- LIGHT DAPPLE animation: grass/roof textures shimmer light<->dark across the
  clip — slow sun/cloud-shadow drift; geometry static, cloth static. New
  ambient layer candidate (animate sun intensity/position or dapple overlay).
- Story blocks in flat color: ONE saturated accent (red counter) vs green
  field, echoed by tiny accents (red pots); white vertical banner with black
  glyph as calligraphy accent; under-roof near-black void.
- Assets: /tmp/opencode/shawn/stall.mp4 (+ stall_full/grid/vendor/banner.png
  crops) — /tmp is ephemeral, re-fetch via
  api.fxtwitter.com/zzzzshawn/status/2112328674750132577
  harmonics; ember envelope `pow(sin(π·cyc),1.4)`; flame
  `0.86+.1·sin(7u)+.06·sin(17u+2.1)`.
- Debug API `window.__env`: seek/setLevels/capture/rgb/debugRay; capture()
  returns canvas dataURL at 1500×1400.
- Offline render: `node tools/render-vignette.mjs <url> <out.mp4>` —
  puppeteer-core (dev dep) + agent-browser's bundled chrome
  (`~/.agent-browser/browsers/chrome-linux64/chrome`, headless-shell),
  seek+capture per frame in chunks of 12, then ffmpeg
  `-framerate 60 -crf 16 -preset slow -pix_fmt yuv420p`. 360 frames ≈ 1.5 min.
  Verified: seam f0↔f359 delta 0.149, life delta f0↔f180 0.252.
- Reusable trick: drive all motion off seek(t) → deterministic capture, rAF
  not needed for recordings; also works for future character animation.
## Why it matters for this repo
- Our `prototype/` already covers build+look (toon post chain, pixel pass,
  grid-snap stability, sprites, character/creep geometry). What we lack is
  steps 1, 4, 5 — all scriptable: ffmpeg for reference measurement, a
  screenshot-per-fixed-tick capture loop (agent-browser or CDP) for render,
  a contact-sheet HTML for review.
- Vignette format implication: FIXED isometric camera (45/30), ortho-friendly —
  our pixel-creep work largely becomes moot for this format; it is the
  zero-creep corner of the pipeline.
- Physics honesty (metres + gravity + hitstop) is what makes the shorts read as
  "animation quality" — applies directly to our avatar/creep animation.

## Assets already pulled for reference
- /tmp is ephemeral — re-fetch URLs if needed. Both videos are twimg mp4s;
  fxtwitter API (api.fxtwitter.com/<user>/status/<id>) returns exact video URLs + jpg thumbs.
