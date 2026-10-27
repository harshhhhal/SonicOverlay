(function (root) {
  'use strict';
  const SO = root.SO, K = SO.ctl;

  SO.registerVisualizer({
    id: 'neon-oscilloscope',
    name: 'Neon Oscilloscope',
    icon: 'oscilloscope',
    layout: 'bottom-slim',
    defaults: {
      amplitude: 120,
      lineThickness: 3,
      traces: 'dual',
      phaseShift: 45,
      persistence: 50,
      glow: 70,
      points: 160
    },
    controls: [
      K.range('amplitude', 'Amplitude (%)', 20, 300),
      K.range('lineThickness', 'Line thickness', 1, 10),
      K.select('traces', 'Traces', [['single', 'Single'], ['dual', 'Dual Phase'], ['tri', 'Tri-Phase']]),
      K.range('phaseShift', 'Phase shift (°)', 10, 180),
      K.range('persistence', 'Persistence (%)', 0, 90),
      K.range('glow', 'Glow intensity', 0, 100),
      K.range('points', 'Resolution', 64, 256)
    ],
    render(c) {
      const { ctx, w, h, f, o, H, dt } = c;
      const n = Math.round(H.clamp(o.points, 32, 256));
      const cy = h / 2;
      const A = (o.amplitude / 100) * (h * 0.44);

      // Resample current real waveform
      const wv = H.resample(f.waveform, n, H.buf(c.st, 'w', n));
      H.smoothArray(wv, n, 1, false);

      // Manage persistence ring buffer in c.st
      const historyDepth = o.persistence > 0 && !c.rm ? Math.round(o.persistence / 18) : 0;
      if (!c.st.hist) c.st.hist = [];
      const hist = c.st.hist;

      // Update history buffer
      if (historyDepth > 0) {
        const snap = new Float32Array(n);
        snap.set(wv);
        hist.unshift(snap);
        while (hist.length > historyDepth) hist.pop();
      } else {
        hist.length = 0;
      }

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Setup glow
      if (o.glow > 0) {
        ctx.shadowColor = (c.cs && c.cs.primary) || c.s.color.primary || '#00f0ff';
        ctx.shadowBlur = (o.glow / 100) * 18 * c.dpr;
      } else {
        H.glowOff(ctx);
      }

      const xs = H.buf(c.st, 'x', n);
      const ys = H.buf(c.st, 'y', n);
      for (let i = 0; i < n; i++) {
        xs[i] = (i / (n - 1)) * w;
      }

      // Draw persistence ghost trails (oldest to newest)
      if (hist.length > 1) {
        const baseAlpha = ctx.globalAlpha;
        for (let hi = hist.length - 1; hi >= 1; hi--) {
          const hw = hist[hi];
          const ageRatio = (hist.length - hi) / hist.length;
          ctx.globalAlpha = baseAlpha * ageRatio * 0.28;
          ctx.lineWidth = Math.max(1, o.lineThickness * 0.75);
          ctx.strokeStyle = H.grad(c);
          for (let i = 0; i < n; i++) {
            ys[i] = H.clamp(cy - hw[i] * A, 0, h);
          }
          ctx.beginPath();
          H.curve(ctx, xs, ys, n);
          ctx.stroke();
        }
        ctx.globalAlpha = baseAlpha;
      }

      const grad = H.grad(c);
      ctx.strokeStyle = grad;

      // Determine trace count and phase shifts
      const traceCount = o.traces === 'tri' ? 3 : o.traces === 'dual' ? 2 : 1;
      const shiftDeg = o.phaseShift * (Math.PI / 180);

      for (let t = 0; t < traceCount; t++) {
        const phaseOffset = t === 0 ? 0 : t === 1 ? shiftDeg : -shiftDeg;
        const phaseSamples = Math.round((phaseOffset / H.TAU) * (n * 0.25));
        const traceAlpha = t === 0 ? 1 : 0.62;

        ctx.globalAlpha = (c.s.color.opacity / 100) * traceAlpha;
        ctx.lineWidth = t === 0 ? o.lineThickness : Math.max(1, o.lineThickness * 0.7);

        for (let i = 0; i < n; i++) {
          const idx = H.clamp(i + phaseSamples, 0, n - 1);
          const distort = H.distort(c, i * 0.1) * h * 0.05;
          ys[i] = H.clamp(cy - wv[idx] * A + distort, 0, h);
        }

        ctx.beginPath();
        H.curve(ctx, xs, ys, n);
        ctx.stroke();
      }

      ctx.restore();
    }
  });
})(typeof self !== 'undefined' ? self : this);
