(function (root) {
  'use strict';
  const SO = root.SO, K = SO.ctl;
  SO.registerVisualizer({
    id: 'frequency-curve', name: 'Frequency Curve', icon: 'curve', layout: 'bottom',
    defaults: { points: 96, lines: 2, interpolation: 'smooth', filled: true, fillOpacity: 22, lineThickness: 3 },
    controls: [K.range('points', 'Points', 16, 256), K.range('lines', 'Lines', 1, 3), K.select('interpolation', 'Interpolation', [['smooth', 'Smooth'], ['linear', 'Linear'], ['step', 'Step']]),
      K.toggle('filled', 'Filled area'), K.range('fillOpacity', 'Fill opacity (%)', 0, 100), K.range('lineThickness', 'Line thickness', 1, 16)],
    render(c) {
      const { ctx, w, h, f, o, H } = c, n = Math.round(o.points), base = ctx.globalAlpha;
      const cur = H.resample(f.spectrum, n, H.buf(c.st, 'cur', n)), ema = H.buf(c.st, 'ema', n), env = H.buf(c.st, 'env', n);
      const k = 1 - Math.pow(0.92, c.dt * 60), fall = Math.pow(0.985, c.dt * 60);
      for (let i = 0; i < n; i++) { ema[i] += (cur[i] - ema[i]) * k; env[i] = Math.max(cur[i], env[i] * fall); }
      const xs = H.buf(c.st, 'x', n * 2), ys = H.buf(c.st, 'y', n * 2);
      const draw = (src, alpha, fill) => {
        let cnt = 0;
        if (o.interpolation === 'step') {
          for (let i = 0; i < n; i++) { const x0 = i / n * w, x1 = (i + 1) / n * w, y = h - src[i] * h * 0.95; xs[cnt] = x0; ys[cnt++] = y; xs[cnt] = x1; ys[cnt++] = y; }
        } else for (let i = 0; i < n; i++) { xs[cnt] = (n > 1 ? i / (n - 1) * w : 0); ys[cnt++] = h - src[i] * h * 0.95; }
        ctx.beginPath();
        if (o.interpolation === 'smooth') H.curve(ctx, xs, ys, cnt); else { ctx.moveTo(xs[0], ys[0]); for (let i = 1; i < cnt; i++) ctx.lineTo(xs[i], ys[i]); }
        ctx.globalAlpha = base * alpha; ctx.stroke();
        if (fill) { ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.save(); H.glowOff(ctx); ctx.globalAlpha = base * (o.fillOpacity / 100); ctx.fillStyle = H.grad(c); ctx.fill(); ctx.restore(); }
      };
      ctx.lineWidth = o.lineThickness; ctx.lineJoin = 'round'; ctx.strokeStyle = H.grad(c); H.glowOn(c);
      if (o.lines >= 3) draw(env, 0.35, false);
      if (o.lines >= 2) draw(ema, 0.55, false);
      draw(cur, 1, o.filled);
      H.glowOff(ctx);
      ctx.globalAlpha = base;
    }
  });
})(typeof self !== 'undefined' ? self : this);
