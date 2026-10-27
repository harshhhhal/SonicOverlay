(function (root) {
  'use strict';
  const SO = root.SO, K = SO.ctl;
  SO.registerVisualizer({
    id: 'circular-waveform', name: 'Circular Waveform', icon: 'circwave', layout: 'center',
    defaults: { radius: 36, amplitude: 45, lineThickness: 3, smoothing: 60, points: 180, filled: false },
    controls: [K.range('radius', 'Radius (%)', 5, 90), K.range('amplitude', 'Amplitude (%)', 5, 120), K.range('lineThickness', 'Line thickness', 1, 16), K.range('smoothing', 'Smoothing', 0, 100),
      K.range('points', 'Points', 32, 256), K.toggle('filled', 'Filled')],
    render(c) {
      const { ctx, w, h, f, o, H } = c, n = Math.round(o.points), R = Math.min(w, h) / 2;
      const wv = H.resample(f.waveform, n, H.buf(c.st, 'w', n));
      const d = wv[n - 1] - wv[0]; for (let i = 0; i < n; i++) wv[i] -= d * i / (n - 1);   // close the loop smoothly
      H.smoothArray(wv, n, Math.round(o.smoothing / 25), true);
      const xs = H.buf(c.st, 'x', n), ys = H.buf(c.st, 'y', n), r0 = R * o.radius / 100, A = R * o.amplitude / 100;
      for (let i = 0; i < n; i++) {
        const a = i / n * H.TAU - Math.PI / 2, r = r0 + wv[i] * A + H.distort(c, a * 6) * R * 0.05;
        xs[i] = w / 2 + Math.cos(a) * r; ys[i] = h / 2 + Math.sin(a) * r;
      }
      ctx.lineWidth = o.lineThickness; ctx.lineJoin = 'round'; ctx.strokeStyle = H.grad(c); H.glowOn(c);
      ctx.beginPath(); H.curveClosed(ctx, xs, ys, n);
      if (o.filled) { ctx.save(); ctx.globalAlpha *= 0.14; ctx.fillStyle = H.grad(c); ctx.shadowBlur = 0; ctx.fill(); ctx.restore(); }
      ctx.stroke(); H.glowOff(ctx);
    }
  });
})(typeof self !== 'undefined' ? self : this);
