(function (root) {
  'use strict';
  const SO = root.SO, K = SO.ctl;
  const MAXP = 600;
  function init(st) {
    st.n = 0; st.acc = 0;
    for (const k of ['x', 'y', 'vx', 'vy', 'life', 'max', 'size', 't']) st[k] = new Float32Array(MAXP);
  }
  SO.registerVisualizer({
    id: 'particle-field', name: 'Particle Field', icon: 'particles', layout: 'full',
    defaults: { maxParticles: 300, connections: false, connectDistance: 90, turbulence: 40, bassPush: 60 },
    controls: [K.range('maxParticles', 'Max particles', 50, MAXP, 10), K.toggle('connections', 'Connect nearby particles'), K.range('connectDistance', 'Connection distance (px)', 20, 200),
      K.range('turbulence', 'Turbulence', 0, 100), K.range('bassPush', 'Bass push', 0, 100)],
    render(c) {
      const { ctx, w, h, f, o, s, H, dt } = c, st = c.st, e = s.effects;
      if (!st.x) init(st);
      const cap = Math.min(MAXP, Math.round(o.maxParticles)), mot = c.rm ? 0.3 : 1, spd = e.particleSpeed / 100 * mot;
      const live = f.live;
      if (live) {
        st.acc += e.particleDensity / 100 * 140 * (0.25 + f.energy * 1.8) * dt;
        if (f.beat > 0.95) st.acc += e.particleDensity / 100 * 25;
      }
      while (st.acc >= 1 && st.n < cap) {
        st.acc -= 1; const i = st.n++, a = Math.random() * H.TAU, v = (20 + Math.random() * 50) * spd;
        st.x[i] = Math.random() * w; st.y[i] = Math.random() * h; st.vx[i] = Math.cos(a) * v; st.vy[i] = Math.sin(a) * v;
        st.max[i] = st.life[i] = e.particleLifetime * (0.6 + Math.random() * 0.8); st.size[i] = e.particleSize * (0.6 + Math.random() * 0.8); st.t[i] = Math.random();
      }
      st.acc = Math.min(st.acc, 5);
      const push = f.bass * o.bassPush / 100 * 260 * spd, turb = o.turbulence / 100 * 90 * mot, damp = Math.pow(0.985, dt * 60), cx = w / 2, cy = h / 2;
      for (let i = 0; i < st.n; i++) {
        st.life[i] -= dt;
        if (st.life[i] <= 0 || st.x[i] < -40 || st.x[i] > w + 40 || st.y[i] < -40 || st.y[i] > h + 40) {  // swap-remove
          const l = --st.n; for (const k of ['x', 'y', 'vx', 'vy', 'life', 'max', 'size', 't']) st[k][i] = st[k][l]; i--; continue;
        }
        const dx = st.x[i] - cx, dy = st.y[i] - cy, d = Math.hypot(dx, dy) || 1;
        st.vx[i] = st.vx[i] * damp + (dx / d * push + Math.sin(st.y[i] * 0.013 + c.time * 1.3 + i) * turb) * dt;
        st.vy[i] = st.vy[i] * damp + (dy / d * push + Math.cos(st.x[i] * 0.011 + c.time * 1.1 + i) * turb) * dt;
        st.x[i] += st.vx[i] * dt; st.y[i] += st.vy[i] * dt;
      }
      const lut = c.cs.lut(16, 1), base = ctx.globalAlpha, glow = s.color.glowIntensity > 0;
      if (o.connections && st.n < 220) {
        const D = o.connectDistance, D2 = D * D; ctx.lineWidth = 1;
        for (let i = 0; i < st.n; i++) for (let j = i + 1; j < st.n; j++) {
          const dx = st.x[i] - st.x[j], dy = st.y[i] - st.y[j], d2 = dx * dx + dy * dy;
          if (d2 < D2) { ctx.globalAlpha = base * 0.35 * (1 - d2 / D2); ctx.strokeStyle = lut[Math.min(15, Math.floor(st.t[i] * 16))]; ctx.beginPath(); ctx.moveTo(st.x[i], st.y[i]); ctx.lineTo(st.x[j], st.y[j]); ctx.stroke(); }
        }
      }
      for (let i = 0; i < st.n; i++) {
        const fr = st.life[i] / st.max[i], a = Math.min(1, Math.sin(Math.PI * (1 - fr)) * 1.6), r = Math.max(0.5, st.size[i] * (0.7 + f.high * 1.2));
        ctx.fillStyle = lut[Math.min(15, Math.floor(st.t[i] * 16))];
        if (glow) { ctx.globalAlpha = base * a * 0.16 * (s.color.glowIntensity / 100); ctx.beginPath(); ctx.arc(st.x[i], st.y[i], r * 3.2, 0, H.TAU); ctx.fill(); }
        ctx.globalAlpha = base * a; ctx.beginPath(); ctx.arc(st.x[i], st.y[i], r, 0, H.TAU); ctx.fill();
      }
      ctx.globalAlpha = base;
    }
  });
})(typeof self !== 'undefined' ? self : this);
