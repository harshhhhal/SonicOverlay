(function (root) {
  'use strict';
  const SO = root.SO, K = SO.ctl;
  SO.registerVisualizer({
    id: 'radial-spectrum', name: 'Radial Spectrum', icon: 'radial', layout: 'center',
    defaults: { barCount: 96, radius: 34, barLength: 38, lineThickness: 3, direction: 'outward', symmetrical: true, rotationSpeed: 12, rounded: true, bassPulse: true },
    controls: [K.range('barCount', 'Bar count', 16, 256), K.range('radius', 'Radius (%)', 5, 90), K.range('barLength', 'Bar length (%)', 5, 90), K.range('lineThickness', 'Bar thickness', 1, 16),
      K.select('direction', 'Direction', [['outward', 'Outward'], ['inward', 'Inward'], ['both', 'Both']]), K.toggle('symmetrical', 'Symmetrical'),
      K.range('rotationSpeed', 'Rotation (deg/s)', -90, 90), K.toggle('rounded', 'Rounded caps'), K.toggle('bassPulse', 'Pulse with bass')],
    render(c) {
      const { ctx, w, h, f, o, H } = c, n = Math.round(o.barCount), cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2;
      const r0 = R * o.radius / 100 * (1 + (o.bassPulse ? f.bass * 0.06 : 0)), L = R * o.barLength / 100;
      const m = o.symmetrical ? Math.ceil(n / 2) : n, vals = H.resample(f.spectrum, m, H.buf(c.st, 'v', m));
      c.st.rot = (c.st.rot || 0) + (c.rm ? 0 : c.dt * o.rotationSpeed * Math.PI / 180);
      ctx.lineWidth = o.lineThickness; ctx.lineCap = o.rounded ? 'round' : 'butt'; ctx.strokeStyle = H.grad(c); H.glowOn(c);
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const v = o.symmetrical ? vals[i < m ? i : n - 1 - i] : vals[i], len = Math.max(0, v * L); if (len < 0.5) continue;
        const a = -Math.PI / 2 + c.st.rot + i / n * H.TAU, ca = Math.cos(a), sa = Math.sin(a);
        const a0 = o.direction === 'outward' ? r0 : o.direction === 'inward' ? r0 : Math.max(0, r0 - len / 2);
        const a1 = o.direction === 'outward' ? r0 + len : o.direction === 'inward' ? Math.max(0, r0 - len) : r0 + len / 2;
        ctx.moveTo(cx + ca * a0, cy + sa * a0); ctx.lineTo(cx + ca * a1, cy + sa * a1);
      }
      ctx.stroke(); H.glowOff(ctx);
    }
  });
})(typeof self !== 'undefined' ? self : this);
