(function (root) {
  'use strict';
  const SO = root.SO, K = SO.ctl;
  SO.registerVisualizer({
    id: 'stacked-spectrum', name: 'Stacked Spectrum', icon: 'stack', layout: 'bottom',
    defaults: { barCount: 32, segCount: 16, segGap: 3, barSpacing: 5, colorBands: false, peaks: true, cornerRadius: 2 },
    controls: [K.range('barCount', 'Bar count', 8, 96), K.range('segCount', 'Segments', 4, 40), K.range('segGap', 'Segment gap (px)', 0, 12), K.range('barSpacing', 'Bar spacing (px)', 0, 24),
      K.toggle('colorBands', 'Color bands'), K.toggle('peaks', 'Peak indicators'), K.range('cornerRadius', 'Corner radius', 0, 12)],
    render(c) {
      const { ctx, w, h, f, o, H } = c, n = Math.round(o.barCount), S = Math.round(o.segCount);
      const vals = H.resample(f.spectrum, n, H.buf(c.st, 'v', n));
      const slot = (w - o.barSpacing * (n - 1)) / n, sh = (h - o.segGap * (S - 1)) / S; if (slot < 1 || sh < 1) return;
      const pk = o.peaks ? H.peaks(c, 'pk', vals, n) : null;
      const colorAt = (r) => { const t = r / Math.max(1, S - 1); return o.colorBands ? c.cs.css(t < 0.6 ? 0 : t < 0.85 ? 0.5 : 1, 0.95) : c.cs.css(t, 0.95); };
      H.glowOn(c, 0.7);
      for (let r = 0; r < S; r++) {
        ctx.beginPath(); let any = false; const y = h - (r + 1) * sh - r * o.segGap;
        for (let i = 0; i < n; i++) if (Math.round(vals[i] * S) > r) { H.rrect(ctx, i * (slot + o.barSpacing), y, slot, sh, o.cornerRadius); any = true; }
        if (any) { ctx.fillStyle = colorAt(r); ctx.fill(); }
      }
      if (pk) {
        ctx.beginPath(); let any = false;
        for (let i = 0; i < n; i++) { const r = Math.round(pk[i] * S) - 1; if (r >= 0 && r >= Math.round(vals[i] * S)) { H.rrect(ctx, i * (slot + o.barSpacing), h - (r + 1) * sh - r * o.segGap, slot, sh, o.cornerRadius); any = true; } }
        if (any) { ctx.fillStyle = c.cs.css(1, 1); ctx.fill(); }
      }
      H.glowOff(ctx);
    }
  });
})(typeof self !== 'undefined' ? self : this);
