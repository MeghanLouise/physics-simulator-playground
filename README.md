# Physics Simulator Toy Playground

A double pendulum, with the equations of motion and RK4 integrator implemented
by hand. Vanilla JS + Canvas, no dependencies or build step.

## Run

ES modules don't load from `file://`, so serve the folder:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Layout

| File | Role |
| --- | --- |
| `js/physics.js` | Pure math: `derivatives`, `rk4`, `energy`, `positions`. No DOM. |
| `js/renderer.js` | Canvas sizing (HiDPI), world→screen transform, trail + pendulum drawing. |
| `js/main.js` | State, slider definitions (`CONTROLS`), fixed-timestep loop. |

The loop steps physics at a fixed 240 Hz and renders once per animation frame,
so the simulation is deterministic regardless of display refresh rate.
The "energy drift" readout is a sanity check on the integrator; it should stay
near zero.

## Features

- **Drag the bobs** directly on the canvas to set θ₁/θ₂ (this pauses the sim,
  zeroes that arm's angular velocity, and syncs the sliders on release).
- **Chaos twin** (orange): a second pendulum started with the same initial
  conditions plus a tiny nudge to θ₁ (adjustable, 1e-8 to 1e-1 rad), stepped
  in parallel. Watch the two trails overlap, then peel apart — sensitivity to
  initial conditions made visible. "Twin separation" in the readout is the
  distance between the two end-effector tips.

## Ideas / TODO

- Poincaré section / phase-space plot
- Randomize button (each `CONTROLS` entry keeps its `input` for pushing values back)
- Swap `physics.js` for an orbital sim — the renderer/loop are system-agnostic-ish
