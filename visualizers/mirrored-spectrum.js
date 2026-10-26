(function (root) {
  'use strict';
  const SO = root.SO, K = SO.ctl;
  SO.registerVisualizer({
    id: 'mirrored-spectrum', name: 'Mirrored Spectrum', icon: 'mirror', layout: 'bottom',
    defaults: { barCount: 64, layout: 'top-bottom', axis: 'horizontal', axisPosition: 50, barSpacing: 3, barWidth: 100, cornerRadius: 3, ownGradient: false, gradA: '#ff4d6d', gradB: '#4d9fff' },
    controls: [K.range('barCount', 'Bar count', 8, 200), K.select('layout', 'Layout', [['top-bottom', 'Top / bottom'], ['center-out', 'Center out']]),
      K.select('axis', 'Symmetry axis', [['horizontal', 'Horizontal'], ['vertical', 'Vertical']]), K.range('axisPosition', 'Axis position (%)', 10, 90),
      K.range('barSpacing', 'Bar spacing (px)', 0, 24), K.range('barWidth', 'Bar width (%)', 10, 100), K.range('cornerRadius', 'Corner radius', 0, 30),
      K.toggle('ownGradient', 'Use its own gradient'), K.color('gradA', 'Gradient start'), K.color('gradB', 'Gradient end')],
    render(c) {
      const { ctx, f, o, H } = c, n = Math.round(o.barCount), vert = o.axis === 'vertical';
      const W = vert ? c.h : c.w, Hh = vert ? c.w : c.h;
      const m = Math.ceil(n / 2), vals = H.resample(f.spectrum, o.layout === 'center-out' ? m : n, H.buf(c.st, 'v', o.layout === 'center-out' ? m : n));
      const cs = o.ownGradient ? SO.Color.simpleSource(o.gradA, o.gradB) : c.cs;
      ctx.save();
      if (vert) { ctx.translate(c.w, 0); ctx.rotate(Math.PI / 2); }
      const gap = o.barSpacing, slot = (W - gap * (n - 1)) / n; if (slot < 0.5) { ctx.restore(); return; }
      const bw = Math.max(1, slot * o.barWidth / 100), off = (slot - bw) / 2, r = Math.min(o.cornerRadius, bw / 2);
      const axisY = Hh * o.axisPosition / 100, up = axisY, down = Hh - axisY;
      const sv = c.s.color; ctx.fillStyle = cs.gradient(ctx, W, Hh, sv.gradientAngle, 1);
      if (sv.glowIntensity > 0) { ctx.shadowBlur = sv.glowRadius * c.dpr; ctx.shadowColor = cs.css(0.5, sv.glowIntensity / 100); } else H.glowOn(c);
      ctx.beginPath();
      for (let k = 0; k < n; k++) {
        const v = o.layout === 'center-out' ? vals[Math.min(m - 1, Math.floor(Math.abs(k - (n - 1) / 2)))] : vals[k];
        const x = k * (slot + gap) + off, hu = v * up, hd = v * down; if (hu + hd < 1) continue;
        H.rrect(ctx, x, axisY - hu, bw, hu + hd, r);
      }
      ctx.fill(); H.glowOff(ctx); ctx.restore();
    }
  });
})(typeof self !== 'undefined' ? self : this);
