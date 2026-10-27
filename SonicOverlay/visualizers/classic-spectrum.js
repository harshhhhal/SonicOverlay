(function (root) {
  'use strict';
  const SO = root.SO, K = SO.ctl;
  SO.registerVisualizer({
    id: 'classic-spectrum', name: 'Classic Spectrum', icon: 'bars', layout: 'bottom',
    defaults: { barCount: 64, barSpacing: 3, barWidth: 100, cornerRadius: 4, rounded: true, mirrored: false, peaks: true },
    controls: [K.range('barCount', 'Bar count', 8, 200), K.range('barSpacing', 'Bar spacing (px)', 0, 24), K.range('barWidth', 'Bar width (%)', 10, 100),
      K.toggle('rounded', 'Rounded ends'), K.range('cornerRadius', 'Corner radius', 0, 30), K.toggle('mirrored', 'Mirrored'), K.toggle('peaks', 'Peak indicators')],
    render(c) {
      const { ctx, w, h, f, o, H } = c, n = Math.round(o.barCount);
      const vals = H.resample(f.spectrum, n, H.buf(c.st, 'v', n));
      const gap = o.barSpacing, slot = (w - gap * (n - 1)) / n; if (slot < 0.5) return;
      const bw = Math.max(1, slot * o.barWidth / 100), off = (slot - bw) / 2, r = o.rounded ? Math.min(o.cornerRadius, bw / 2) : 0;
      const half = o.mirrored ? h / 2 : h, mid = h / 2;
      ctx.fillStyle = H.grad(c); H.glowOn(c);
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const bh = vals[i] * half; if (bh < 1) continue;
        const x = i * (slot + gap) + off;
        if (o.mirrored) H.rrect(ctx, x, mid - bh, bw, bh * 2, r); else H.rrect(ctx, x, h - bh, bw, bh, r);
      }
      ctx.fill();
      if (o.peaks) {
        const pk = H.peaks(c, 'pk', vals, n); ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const p = pk[i] * half; if (p < 2) continue; const x = i * (slot + gap) + off;
          if (o.mirrored) { ctx.rect(x, Math.max(0, mid - p - 4), bw, 3); ctx.rect(x, Math.min(h - 3, mid + p + 1), bw, 3); } else ctx.rect(x, Math.max(0, h - p - 4), bw, 3);
        }
        ctx.fill();
      }
      H.glowOff(ctx);
    }
  });
})(typeof self !== 'undefined' ? self : this);
