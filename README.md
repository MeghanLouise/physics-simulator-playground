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

## Ideas / TODO

- Drag the bobs with the mouse to set initial conditions
- Second pendulum with a 1e-6 offset to show sensitivity to initial conditions
- Poincaré section / phase-space plot
- Randomize button (each `CONTROLS` entry keeps its `input` for pushing values back)
- Swap `physics.js` for an orbital sim — the renderer/loop are system-agnostic-ish
