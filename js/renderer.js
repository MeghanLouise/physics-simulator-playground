import { positions } from './physics.js';

// Owns the canvas: HiDPI sizing, world->screen transform, trail + pendulum drawing.
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = 0; // CSS pixels
    this.height = 0;
    this.resize();
    new ResizeObserver(() => this.resize()).observe(canvas);
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Pixels per world unit, so the fully extended pendulum always fits.
  scale(p) {
    return (Math.min(this.width, this.height) / 2 / (p.L1 + p.L2)) * 0.9;
  }

  toScreen(x, y, p) {
    const k = this.scale(p);
    return [this.width / 2 + x * k, this.height / 2 + y * k];
  }

  draw(state, params, trail) {
    const { ctx, width, height } = this;
    ctx.clearRect(0, 0, width, height);
    this.drawTrail(trail, params);
    this.drawPendulum(state, params);
  }

  // trail: array of {x, y, speed} in world units, oldest first.
  drawTrail(trail, params) {
    const { ctx } = this;
    const n = trail.length;
    if (n < 2) return;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (let i = 1; i < n; i++) {
      const a = trail[i - 1];
      const b = trail[i];
      const [ax, ay] = this.toScreen(a.x, a.y, params);
      const [bx, by] = this.toScreen(b.x, b.y, params);
      const age = i / n; // 0 = oldest, 1 = newest
      const hue = 220 - Math.min(b.speed / 12, 1) * 220; // blue (slow) -> red (fast)
      ctx.strokeStyle = `hsla(${hue}, 90%, 60%, ${age * age})`;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }
  }

  drawPendulum(state, params) {
    const { ctx } = this;
    const { x1, y1, x2, y2 } = positions(state, params);
    const [px, py] = this.toScreen(0, 0, params);
    const [ax, ay] = this.toScreen(x1, y1, params);
    const [bx, by] = this.toScreen(x2, y2, params);

    ctx.strokeStyle = '#8b93a7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();

    // Bob radius scales with sqrt(mass) so heavier bobs look heavier.
    const r = (m) => 6 + 5 * Math.sqrt(m);
    ctx.fillStyle = '#8b93a7';
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#e8eaf0';
    for (const [x, y, m] of [
      [ax, ay, params.m1],
      [bx, by, params.m2],
    ]) {
      ctx.beginPath();
      ctx.arc(x, y, r(m), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
