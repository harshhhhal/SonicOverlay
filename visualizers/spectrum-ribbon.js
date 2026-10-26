(function (root) {
  'use strict';
  const SO = root.SO, K = SO.ctl;

  SO.registerVisualizer({
    id: 'spectrum-ribbon',
    name: 'Spectrum Ribbon',
    icon: 'specribbon',
    layout: 'bottom',
    defaults: {
      layers: 3,
      points: 64,
      smoothing: 55,
      waveHeight: 90,
      fill: true,
      flowSpeed: 100
    },
    controls: [
      K.range('layers', 'Trail layers', 1, 5),
      K.range('points', 'Resolution', 32, 128),
      K.range('smoothing', 'Smoothing', 10, 90),
      K.range('waveHeight', 'Height (%)', 20, 200),
      K.toggle('fill', 'Fill surface'),
      K.range('flowSpeed', 'Phase flow', 20, 200)
    ],
    render(c) {
      const { ctx, w, h, f, o, H, dt } = c;
      const n = Math.round(H.clamp(o.points, 24, 128));
      const layerCount = Math.round(H.clamp(o.layers, 1, 5));
      const maxH = (o.waveHeight / 100) * (h * 0.78);
      const baseY = h * 0.94;
      const speed = c.rm ? 0 : (o.flowSpeed / 100);

      const spec = H.resample(f.spectrum, n, H.buf(c.st, 'sp', n));
      const smoothPasses = Math.round((o.smoothing / 100) * 5);
      if (smoothPasses > 0) H.smoothArray(spec, n, smoothPasses, false);

      // Manage temporal history buffer for trailing ribbon layers
      if (!c.st.hist) c.st.hist = [];
      const hist = c.st.hist;

      // Update history buffer on timer to maintain fluid trailing ribbon effect
      if (typeof c.st.stepTimer !== 'number') c.st.stepTimer = 0;
      c.st.stepTimer += dt;
      if (c.st.stepTimer > 0.035) {
        c.st.stepTimer = 0;
        const snap = new Float32Array(n);
        snap.set(spec);
        hist.unshift(snap);
        while (hist.length > layerCount) hist.pop();
      }

      if (typeof c.st.phase !== 'number') c.st.phase = 0;
      c.st.phase += dt * speed * (0.8 + f.energy * 1.2);

      const xs = H.buf(c.st, 'x', n);
      const ys = H.buf(c.st, 'y', n);
      for (let i = 0; i < n; i++) {
        xs[i] = (i / (n - 1)) * w;
      }

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      H.glowOn(c);

      const grad = H.grad(c);
      const baseAlpha = c.s.color.opacity / 100;

      // Draw layers from back (oldest) to front (newest)
      for (let lay = Math.min(layerCount - 1, hist.length - 1); lay >= 0; lay--) {
        const layerData = hist[lay] || spec;
        const depth = lay / Math.max(1, layerCount - 1);
        const layerAlpha = (1 - depth * 0.5);
        const layerPhase = c.st.phase - lay * 0.4;
        const layerScale = 1 - depth * 0.18;

        for (let i = 0; i < n; i++) {
          const t = i / (n - 1);
          const flowUndulate = Math.sin(t * 4 + layerPhase) * (h * 0.04 * (1 + f.mid * 0.5));
          const audioAmp = layerData[i] * maxH * layerScale;
          const distort = H.distort(c, i * 0.15 + layerPhase) * h * 0.05;
          ys[i] = H.clamp(baseY - audioAmp - flowUndulate + distort, 4, h);
        }

        ctx.strokeStyle = grad;
        ctx.lineWidth = Math.max(1, (2.6 - depth * 1.2) * (1 + (lay === 0 ? f.bass * 0.5 : 0)));

        if (o.fill) {
          ctx.beginPath();
          ctx.moveTo(0, h);
          H.curve(ctx, xs, ys, n);
          ctx.lineTo(w, h);
          ctx.closePath();
          ctx.fillStyle = grad;
          ctx.globalAlpha = baseAlpha * (0.1 + (1 - depth) * 0.22);
          ctx.fill();
        }

        ctx.globalAlpha = baseAlpha * layerAlpha;
        ctx.beginPath();
        H.curve(ctx, xs, ys, n);
        ctx.stroke();
      }

      ctx.restore();
    }
  });
})(typeof self !== 'undefined' ? self : this);
