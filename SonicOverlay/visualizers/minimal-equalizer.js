(function (root) {
  'use strict';
  const SO = root.SO, K = SO.ctl;
  SO.registerVisualizer({
    id: 'minimal-equalizer', name: 'Minimal Equalizer', icon: 'eq', layout: 'corner',
    defaults: { barCount: 24, barWidth: 3, barSpacing: 3, rounded: true, monochrome: false, monoColor: '#ffffff', alpha: 85 },
    controls: [K.range('barCount', 'Bar count', 8, 64), K.range('barWidth', 'Bar width (px)', 1, 10), K.range('barSpacing', 'Bar spacing (px)', 1, 16), K.toggle('rounded', 'Rounded ends'),
      K.toggle('monochrome', 'Monochrome'), K.color('monoColor', 'Mono color'), K.range('alpha', 'Opacity (%)', 20, 100)],
    render(c) {
      const { ctx, w, h, f, o, H } = c, n = Math.round(o.barCount), vals = H.resample(f.spectrum, n, H.buf(c.st, 'v', n));
      const total = n * o.barWidth + (n - 1) * o.barSpacing, x0 = (w - total) / 2;
      ctx.globalAlpha *= o.alpha / 100;
      ctx.fillStyle = o.monochrome ? o.monoColor : H.grad(c); if (!o.monochrome) H.glowOn(c);
      ctx.beginPath();
      for (let i = 0; i < n; i++) { const bh = Math.max(f.live ? 1.5 : 0, vals[i] * h); if (bh > 0) H.rrect(ctx, x0 + i * (o.barWidth + o.barSpacing), h - bh, o.barWidth, bh, o.rounded ? o.barWidth / 2 : 0); }
      ctx.fill(); H.glowOff(ctx);
    }
  });
})(typeof self !== 'undefined' ? self : this);
