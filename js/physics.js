// Double pendulum physics. No DOM, no canvas — pure functions so it can be
// tested in Node and swapped for a different system later.
//
// State:  s = [theta1, theta2, omega1, omega2]   (radians, rad/s)
// Params: p = { m1, m2, L1, L2, g }
// theta = 0 hangs straight down; positive angles swing to the right (clockwise on screen).

export const DEFAULT_PARAMS = { m1: 1, m2: 1, L1: 1, L2: 1, g: 9.81 };

export const DEFAULT_INITIAL = {
  theta1: (120 * Math.PI) / 180,
  theta2: (-10 * Math.PI) / 180,
  omega1: 0,
  omega2: 0,
};

export function initialState({ theta1, theta2, omega1, omega2 }) {
  return [theta1, theta2, omega1, omega2];
}

// Time derivative of the state, from the Lagrangian equations of motion.
export function derivatives(s, p) {
  const [t1, t2, w1, w2] = s;
  const { m1, m2, L1, L2, g } = p;

  const d = t1 - t2;
  const sinD = Math.sin(d);
  const cosD = Math.cos(d);
  const den = 2 * m1 + m2 - m2 * Math.cos(2 * d);

  const a1 =
    (-g * (2 * m1 + m2) * Math.sin(t1) -
      m2 * g * Math.sin(t1 - 2 * t2) -
      2 * sinD * m2 * (w2 * w2 * L2 + w1 * w1 * L1 * cosD)) /
    (L1 * den);

  const a2 =
    (2 *
      sinD *
      (w1 * w1 * L1 * (m1 + m2) +
        g * (m1 + m2) * Math.cos(t1) +
        w2 * w2 * L2 * m2 * cosD)) /
    (L2 * den);

  return [w1, w2, a1, a2];
}

const axpy = (s, k, h) => s.map((v, i) => v + h * k[i]);

// One classic 4th-order Runge–Kutta step. Returns a new state array.
export function rk4(s, p, dt) {
  const k1 = derivatives(s, p);
  const k2 = derivatives(axpy(s, k1, dt / 2), p);
  const k3 = derivatives(axpy(s, k2, dt / 2), p);
  const k4 = derivatives(axpy(s, k3, dt), p);
  return s.map((v, i) => v + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}

// Bob positions in world units, pivot at origin, y pointing DOWN (screen-style).
export function positions(s, p) {
  const [t1, t2] = s;
  const x1 = p.L1 * Math.sin(t1);
  const y1 = p.L1 * Math.cos(t1);
  return { x1, y1, x2: x1 + p.L2 * Math.sin(t2), y2: y1 + p.L2 * Math.cos(t2) };
}

// Total mechanical energy. Should stay ~constant; drift means the
// integrator/timestep is too coarse. Useful as a sanity check.
export function energy(s, p) {
  const [t1, t2, w1, w2] = s;
  const { m1, m2, L1, L2, g } = p;
  const y1 = -L1 * Math.cos(t1);
  const y2 = y1 - L2 * Math.cos(t2);
  const V = m1 * g * y1 + m2 * g * y2;
  const T =
    0.5 * m1 * L1 * L1 * w1 * w1 +
    0.5 * m2 * (L1 * L1 * w1 * w1 + L2 * L2 * w2 * w2 + 2 * L1 * L2 * w1 * w2 * Math.cos(t1 - t2));
  return T + V;
}
