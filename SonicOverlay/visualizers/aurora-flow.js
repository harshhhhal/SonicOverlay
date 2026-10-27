(function (root) {
  'use strict';
  const SO = root.SO, K = SO.ctl;

  SO.registerVisualizer({
    id: 'aurora-flow',
    name: 'Aurora Flow',
    icon: 'aurora',
    layout: 'full',
    defaults: {
      curtains: 4,
      height: 75,
      flowSpeed: 80,
      shimmer: 50,
      glowIntensity: 60,
      points: 56
    },
    controls: [
      K.range('curtains', 'Curtain layers', 2, 6),
      K.range('height', 'Curtain height', 20, 180),
      K.range('flowSpeed', 'Flow speed', 20, 200),
      K.range('shimmer', 'Shimmer', 0, 100),
      K.range('glowIntensity', 'Edge glow', 0, 100),
      K.range('points', 'Resolution', 32, 96)
    ],
    render(c) {
      const { ctx, w, h, f, o, H, dt } = c;
      const n = Math.round(H.clamp(o.points, 24, 96));
      const curtainCount = Math.round(H.clamp(o.curtains, 2, 6));
      const maxH = (o.height / 100) * (h * 0.7);
      const speed = c.rm ? 0 : (o.flowSpeed / 100);
      const baseY = h * 0.88;

      const spec = H.resample(f.spectrum, n, H.buf(c.st, 'sp', n));
      H.smoothArray(spec, n, 3, false);

      if (typeof c.st.flow !== 'number') c.st.flow = 0;
      c.st.flow += dt * speed * (0.8 + f.energy * 1.2);

      const xs = H.buf(c.st, 'x', n);
      const ysTop = H.buf(c.st, 'yt', n);
      const ysBot = H.buf(c.st, 'yb', n);
      for (let i = 0; i < n; i++) {
        xs[i] = (i / (n - 1)) * w;
      }

      ctx.save();
      const baseAlpha = ctx.globalAlpha;

      for (let k = 0; k < curtainCount; k++) {
        const layerRatio = k / (curtainCount - 1);
        const phase = c.st.flow * (0.7 + layerRatio * 0.4) + k * 1.8;
        const curAlpha = (0.2 + (1 - layerRatio) * 0.35) * (0.6 + f.energy * 0.6);

        for (let i = 0; i < n; i++) {
          const t = i / (n - 1);
          const undulation = Math.sin(t * 3.5 + phase) * Math.cos(t * 2.2 + phase * 0.7) * (h * 0.12);
          const audioLift = (spec[i] * 0.7 + (k === 0 ? f.bass : f.mid) * 0.3) * maxH;
          const shimmerVal = (o.shimmer / 100) * Math.sin(t * 12 + phase * 3) * (h * 0.02 * f.high);

          const topY = H.clamp(baseY - audioLift - undulation + shimmerVal, 10, h - 20);
          const botY = H.clamp(baseY + Math.sin(t * 2 + phase) * (h * 0.05), topY + 15, h);

          ysTop[i] = topY;
          ysBot[i] = botY;
        }

        // Draw soft vertical curtain body
        ctx.save();
        const curGrad = ctx.createLinearGradient(0, 0, 0, h);
        const colPrim = (c.cs && c.cs.primary) || c.s.color.primary || '#00f0ff';
        const colSec = (c.cs && c.cs.secondary) || c.s.color.secondary || '#7a5cff';

        curGrad.addColorStop(0, 'rgba(0,0,0,0)');
        curGrad.addColorStop(0.35, colPrim);
        curGrad.addColorStop(0.85, colSec);
        curGrad.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.fillStyle = curGrad;
        ctx.globalAlpha = baseAlpha * curAlpha * 0.7;

        ctx.beginPath();
        H.curve(ctx, xs, ysTop, n);
        for (let i = n - 1; i >= 0; i--) {
          ctx.lineTo(xs[i], ysBot[i]);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Draw crisp luminous curtain crest edge
        ctx.save();
        if (o.glowIntensity > 0) {
          ctx.shadowColor = colPrim;
          ctx.shadowBlur = (o.glowIntensity / 100) * 16 * c.dpr;
        }
        ctx.strokeStyle = H.grad(c);
        ctx.lineWidth = Math.max(1, (2.4 - layerRatio * 1.2) * (1 + f.beat * 0.4));
        ctx.globalAlpha = baseAlpha * (0.6 + (1 - layerRatio) * 0.4);
        ctx.beginPath();
        H.curve(ctx, xs, ysTop, n);
        ctx.stroke();
        ctx.restore();
      }

      ctx.restore();
    }
  });
})(typeof self !== 'undefined' ? self : this);
