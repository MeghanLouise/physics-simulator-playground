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

let state = initialState(initial);
let e0 = energy(state, params);
let trail = [];
let paused = false;

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
];

// ---- Simulation control ----------------------------------------------------

function reset() {
  state = initialState(initial);
  e0 = energy(state, params);
  trail = [];
  const { x2, y2 } = positions(state, params);
  trail.push({ x: x2, y: y2, speed: 0 });
}

function trimTrail() {
  if (trail.length > view.trailLength) trail.splice(0, trail.length - view.trailLength);
}

function step(dt) {
  state = rk4(state, params, dt);
}

function recordTrail() {
  const { x2, y2 } = positions(state, params);
  const speed = Math.hypot(state[2], state[3]);
  trail.push({ x: x2, y: y2, speed });
  trimTrail();
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
    const show = () => (val.textContent = `${Number(input.value).toFixed(c.step < 1 ? 2 : 0)}${c.unit ?? ''}`);
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

function setPaused(p) {
  paused = p;
  pauseBtn.textContent = paused ? 'Play' : 'Pause';
}

pauseBtn.addEventListener('click', () => setPaused(!paused));
resetBtn.addEventListener('click', reset);
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

  renderer.draw(state, params, view.trailLength > 0 ? trail : []);

  const drift = ((energy(state, params) - e0) / (Math.abs(e0) || 1)) * 100;
  readoutEl.textContent = `energy drift: ${drift.toFixed(4)}%`;

  requestAnimationFrame(frame);
}

buildControls();
reset();
requestAnimationFrame(frame);
