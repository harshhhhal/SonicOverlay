(function (root) {
  'use strict';
  const SO = root.SO, K = SO.ctl;
  SO.registerVisualizer({
    id: 'dot-spectrum', name: 'Dot Spectrum', icon: 'dots', layout: 'bottom',
    defaults: { columns: 36, dotCount: 12, dotSize: 70, orientation: 'vertical', showInactive: true },
    controls: [K.range('columns', 'Frequency columns', 8, 96), K.range('dotCount', 'Dots per column', 3, 32), K.range('dotSize', 'Dot size (%)', 20, 100),
      K.select('orientation', 'Layout', [['vertical', 'Vertical'], ['horizontal', 'Horizontal']]), K.toggle('showInactive', 'Show inactive dots')],
    render(c) {
      const { ctx, w, h, f, o, H } = c, A = Math.round(o.columns), B = Math.round(o.dotCount), vert = o.orientation === 'vertical';
      const vals = H.resample(f.spectrum, A, H.buf(c.st, 'v', A));
      const cw = (vert ? w : h) / A, ch = (vert ? h : w) / B, rad = Math.max(0.5, Math.min(cw, ch) * o.dotSize / 200);
      const lut = c.cs.lut(B, 1);
      const pos = (a, b) => (vert ? [(a + 0.5) * cw, h - (b + 0.5) * ch] : [(b + 0.5) * ch, (a + 0.5) * cw]);
      if (o.showInactive) {
        ctx.save(); ctx.globalAlpha *= 0.08; ctx.fillStyle = c.cs.css(0.5, 1); ctx.beginPath();
        for (let a = 0; a < A; a++) for (let b = 0; b < B; b++) { const p = pos(a, b); ctx.moveTo(p[0] + rad, p[1]); ctx.arc(p[0], p[1], rad, 0, H.TAU); }
        ctx.fill(); ctx.restore();
      }
      H.glowOn(c);
      for (let b = 0; b < B; b++) {
        ctx.beginPath(); let any = false;
        for (let a = 0; a < A; a++) if (b < vals[a] * B) { const p = pos(a, b); ctx.moveTo(p[0] + rad, p[1]); ctx.arc(p[0], p[1], rad, 0, H.TAU); any = true; }
        if (any) { ctx.fillStyle = lut[b]; ctx.fill(); }
      }
      H.glowOff(ctx);
    }
  });
})(typeof self !== 'undefined' ? self : this);
