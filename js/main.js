import {
  DEFAULT_INITIAL,
  DEFAULT_PARAMS,
  energy,
  initialState,
  positions,
  rk4,
} from './physics.js';
import { Renderer } from './renderer.js';

const FIXED_DT = 1 / 240; // physics step (s), independent of display refresh rate
const MAX_FRAME = 0.05; // clamp long frames (e.g. background tab) to avoid a spiral

// ---- Mutable app state -----------------------------------------------------

const initial = { ...DEFAULT_INITIAL };
const params = { ...DEFAULT_PARAMS };
const view = { trailLength: 600, timeScale: 1 };
// "Twin" pendulum: same initial conditions plus a tiny nudge to theta1,
// simulated in parallel. How fast it drifts apart from the main pendulum is
// a hands-on demo of sensitivity to initial conditions (the butterfly effect).
const twin = { enabled: true, deltaExp: -6 };

let state = initialState(initial);
let twinState = state;
let e0 = energy(state, params);
let trail = [];
let twinTrail = [];
let paused = false;
let dragging = null; // 'bob1' | 'bob2' | null

// ---- Control definitions (add a row here to add a slider) ------------------
// target: which object the slider writes to. resets: restart the sim on change.

const DEG = Math.PI / 180;
const CONTROLS = [
  { group: 'Initial conditions' },
  { target: initial, key: 'theta1', label: 'θ₁', min: -180, max: 180, step: 1, unit: '°', scale: DEG, resets: true },
  { target: initial, key: 'theta2', label: 'θ₂', min: -180, max: 180, step: 1, unit: '°', scale: DEG, resets: true },
  { target: initial, key: 'omega1', label: 'ω₁', min: -10, max: 10, step: 0.1, unit: ' rad/s', resets: true },
  { target: initial, key: 'omega2', label: 'ω₂', min: -10, max: 10, step: 0.1, unit: ' rad/s', resets: true },

  { group: 'Parameters' },
  { target: params, key: 'm1', label: 'm₁', min: 0.1, max: 5, step: 0.1, unit: ' kg', resets: true },
  { target: params, key: 'm2', label: 'm₂', min: 0.1, max: 5, step: 0.1, unit: ' kg', resets: true },
  { target: params, key: 'L1', label: 'L₁', min: 0.2, max: 2, step: 0.05, unit: ' m', resets: true },
  { target: params, key: 'L2', label: 'L₂', min: 0.2, max: 2, step: 0.05, unit: ' m', resets: true },
  { target: params, key: 'g', label: 'g', min: 0, max: 30, step: 0.01, unit: ' m/s²' }, // live: safe to change mid-run

  { group: 'View' },
  { target: view, key: 'trailLength', label: 'Trail', min: 0, max: 3000, step: 50, unit: ' pts', onChange: trimTrail },
  { target: view, key: 'timeScale', label: 'Speed', min: 0.1, max: 3, step: 0.1, unit: '×' },

  { group: 'Chaos twin' },
  { type: 'checkbox', target: twin, key: 'enabled', label: 'Show twin', onChange: () => { twinTrail = []; } },
  {
    target: twin,
    key: 'deltaExp',
    label: 'Δθ₁',
    min: -8,
    max: -1,
    step: 1,
    format: (v) => `1e${v} rad`,
    resets: true,
  },
];

// ---- Simulation control ----------------------------------------------------

function reset() {
  state = initialState(initial);
  twinState = initialState({ ...initial, theta1: initial.theta1 + Math.pow(10, twin.deltaExp) });
  e0 = energy(state, params);
  trail = [];
  twinTrail = [];
  const { x2, y2 } = positions(state, params);
  trail.push({ x: x2, y: y2, speed: 0 });
  twinTrail.push({ x: x2, y: y2, speed: 0 });
}

function trimTrail() {
  if (trail.length > view.trailLength) trail.splice(0, trail.length - view.trailLength);
  if (twinTrail.length > view.trailLength) twinTrail.splice(0, twinTrail.length - view.trailLength);
}

function step(dt) {
  state = rk4(state, params, dt);
  // Always advance the twin, even while hidden, so it stays in lockstep
  // (same elapsed time) with the main pendulum whenever it's shown again.
  twinState = rk4(twinState, params, dt);
}

function recordTrail() {
  const { x2, y2 } = positions(state, params);
  const speed = Math.hypot(state[2], state[3]);
  trail.push({ x: x2, y: y2, speed });
  if (twin.enabled) {
    const t = positions(twinState, params);
    twinTrail.push({ x: t.x2, y: t.y2, speed: Math.hypot(twinState[2], twinState[3]) });
  }
  trimTrail();
}

// Euclidean distance between the two second-bob tips, in world units —
// a simple readout of how far the twin has diverged from the original.
function twinSeparation() {
  const a = positions(state, params);
  const b = positions(twinState, params);
  return Math.hypot(a.x2 - b.x2, a.y2 - b.y2);
}

// ---- UI --------------------------------------------------------------------

const canvas = document.getElementById('sim');
const renderer = new Renderer(canvas);
const controlsEl = document.getElementById('controls');
const readoutEl = document.getElementById('readout');
const pauseBtn = document.getElementById('pause');
const resetBtn = document.getElementById('reset');

function buildControls() {
  for (const c of CONTROLS) {
    if (c.group) {
      const h = document.createElement('h2');
      h.textContent = c.group;
      controlsEl.appendChild(h);
      continue;
    }

    if (c.type === 'checkbox') {
      const row = document.createElement('label');
      row.className = 'row row-checkbox';
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = c.label;
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = c.target[c.key];
      input.addEventListener('change', () => {
        c.target[c.key] = input.checked;
        if (c.resets) reset();
        c.onChange?.();
      });
      row.append(name, input);
      controlsEl.appendChild(row);
      c.input = input;
      continue;
    }

    const scale = c.scale ?? 1;
    const row = document.createElement('label');
    row.className = 'row';
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = c.label;
    const input = document.createElement('input');
    input.type = 'range';
    input.min = c.min;
    input.max = c.max;
    input.step = c.step;
    input.value = c.target[c.key] / scale;
    const val = document.createElement('output');
    const show = () =>
      (val.textContent = c.format
        ? c.format(Number(input.value))
        : `${Number(input.value).toFixed(c.step < 1 ? 2 : 0)}${c.unit ?? ''}`);
    show();
    input.addEventListener('input', () => {
      c.target[c.key] = Number(input.value) * scale;
      show();
      if (c.resets) reset();
      c.onChange?.();
    });
    row.append(name, input, val);
    controlsEl.appendChild(row);
    c.input = input; // so a future "randomize" can push values back into the UI
  }
}

// Push the current value of a slider/checkbox for `target[key]` back into its
// input element, e.g. after a drag sets initial.theta1 programmatically.
function syncControl(target, key) {
  const c = CONTROLS.find((c) => c.target === target && c.key === key);
  if (!c || !c.input) return;
  if (c.type === 'checkbox') {
    c.input.checked = target[key];
  } else {
    c.input.value = target[key] / (c.scale ?? 1);
    c.input.dispatchEvent(new Event('input'));
  }
}

function setPaused(p) {
  paused = p;
  pauseBtn.textContent = paused ? 'Play' : 'Pause';
}

pauseBtn.addEventListener('click', () => setPaused(!paused));
resetBtn.addEventListener('click', reset);

// ---- Drag a bob to set its initial angle -----------------------------------

let wasPausedBeforeDrag = false;

function bobHit(mx, my) {
  const { x1, y1, x2, y2 } = positions(state, params);
  const [ax, ay] = renderer.toScreen(x1, y1, params);
  const [bx, by] = renderer.toScreen(x2, y2, params);
  const near = (px, py) => Math.hypot(mx - px, my - py) < 20;
  // Check bob2 first: it's drawn on top and, when the arm is folded back, sits
  // closer to bob1 than to the pivot.
  if (near(bx, by)) return 'bob2';
  if (near(ax, ay)) return 'bob1';
  return null;
}

canvas.addEventListener('pointerdown', (e) => {
  const hit = bobHit(e.offsetX, e.offsetY);
  if (!hit) return;
  dragging = hit;
  wasPausedBeforeDrag = paused;
  paused = true;
  canvas.classList.add('dragging');
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const [wx, wy] = renderer.toWorld(e.offsetX, e.offsetY, params);
  if (dragging === 'bob1') {
    state[0] = Math.atan2(wx, wy);
    state[2] = 0;
  } else {
    const { x1, y1 } = positions(state, params);
    state[1] = Math.atan2(wx - x1, wy - y1);
    state[3] = 0;
  }
});

function endDrag() {
  if (!dragging) return;
  canvas.classList.remove('dragging');
  if (dragging === 'bob1') {
    initial.theta1 = state[0];
    initial.omega1 = 0;
    syncControl(initial, 'theta1');
    syncControl(initial, 'omega1');
  } else {
    initial.theta2 = state[1];
    initial.omega2 = 0;
    syncControl(initial, 'theta2');
    syncControl(initial, 'omega2');
  }
  dragging = null;
  setPaused(wasPausedBeforeDrag);
}

canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement && e.target.type !== 'range') return;
  if (e.code === 'Space') {
    e.preventDefault();
    setPaused(!paused);
  } else if (e.code === 'KeyR') {
    reset();
  }
});

// ---- Main loop -------------------------------------------------------------

let last = performance.now();
let acc = 0;

function frame(now) {
  const dt = Math.min((now - last) / 1000, MAX_FRAME);
  last = now;

  if (!paused) {
    acc += dt * view.timeScale;
    while (acc >= FIXED_DT) {
      step(FIXED_DT);
      acc -= FIXED_DT;
    }
    if (view.trailLength > 0) recordTrail();
  }

  renderer.draw(
    state,
    params,
    view.trailLength > 0 ? trail : [],
    twin.enabled ? { state: twinState, trail: view.trailLength > 0 ? twinTrail : [] } : null,
  );

  const drift = ((energy(state, params) - e0) / (Math.abs(e0) || 1)) * 100;
  let readout = `energy drift: ${drift.toFixed(4)}%`;
  if (twin.enabled) readout += `  ·  twin separation: ${twinSeparation().toFixed(4)} m`;
  readoutEl.textContent = readout;

  requestAnimationFrame(frame);
}

buildControls();
reset();
requestAnimationFrame(frame);
