(function (root) {
  'use strict';
  const SO = root.SO, K = SO.ctl;
  SO.registerVisualizer({
    id: 'linear-waveform', name: 'Linear Waveform', icon: 'linwave', layout: 'bottom-slim',
    defaults: { amplitude: 100, lineThickness: 3, smoothing: 60, mode: 'single', fill: false, points: 200 },
    controls: [K.range('amplitude', 'Amplitude (%)', 10, 300), K.range('lineThickness', 'Line thickness', 1, 16), K.range('smoothing', 'Smoothing', 0, 100),
      K.select('mode', 'Mode', [['single', 'Single'], ['mirrored', 'Mirrored']]), K.toggle('fill', 'Fill area'), K.range('points', 'Points', 32, 256)],
    render(c) {
      const { ctx, w, h, f, o, H } = c, n = Math.round(o.points), cy = h / 2, A = o.amplitude / 100 * h / 2;
      const wv = H.resample(f.waveform, n, H.buf(c.st, 'w', n)); H.smoothArray(wv, n, Math.round(o.smoothing / 25), false);
      const xs = H.buf(c.st, 'x', n), ys = H.buf(c.st, 'y', n), ys2 = H.buf(c.st, 'y2', n);
      for (let i = 0; i < n; i++) {
        const x = i / (n - 1) * w, d = H.distort(c, i * 0.15) * h * 0.06;
        xs[i] = x; ys[i] = H.clamp(cy - wv[i] * A + d, 0, h); ys2[i] = H.clamp(cy + wv[i] * A - d, 0, h);
      }
      ctx.lineWidth = o.lineThickness; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = H.grad(c); H.glowOn(c);
      ctx.beginPath(); H.curve(ctx, xs, ys, n); ctx.stroke();
      if (o.mode === 'mirrored') { ctx.beginPath(); H.curve(ctx, xs, ys2, n); ctx.stroke(); }
      if (o.fill) {
        ctx.save(); H.glowOff(ctx); ctx.globalAlpha *= 0.16; ctx.fillStyle = H.grad(c); ctx.beginPath(); H.curve(ctx, xs, ys, n);
        if (o.mode === 'mirrored') { for (let i = n - 1; i >= 0; i--) ctx.lineTo(xs[i], ys2[i]); } else { ctx.lineTo(w, cy); ctx.lineTo(0, cy); }
        ctx.closePath(); ctx.fill(); ctx.restore();
      }
      H.glowOff(ctx);
    }
  });
})(typeof self !== 'undefined' ? self : this);
