(function (root) {
  'use strict';
  const SO = root.SO, K = SO.ctl;

  SO.registerVisualizer({
    id: 'liquid-ribbon',
    name: 'Liquid Ribbon',
    icon: 'ribbon',
    layout: 'bottom',
    defaults: {
      ribbons: 3,
      waveHeight: 85,
      waviness: 50,
      fill: true,
      tension: 60,
      speed: 100,
      points: 72
    },
    controls: [
      K.range('ribbons', 'Ribbon layers', 1, 5),
      K.range('waveHeight', 'Wave height', 20, 200),
      K.range('waviness', 'Curvature', 10, 100),
      K.toggle('fill', 'Fill underneath'),
      K.range('tension', 'Smoothness', 20, 100),
      K.range('speed', 'Flow speed', 20, 200),
      K.range('points', 'Resolution', 32, 128)
    ],
    render(c) {
      const { ctx, w, h, f, o, H, time, dt } = c;
      const n = Math.round(H.clamp(o.points, 24, 128));
      const ribbonCount = Math.round(H.clamp(o.ribbons, 1, 5));
      const maxH = (o.waveHeight / 100) * (h * 0.75);
      const speed = c.rm ? 0 : (o.speed / 100);
      const baseY = h * 0.92;

      // Resample spectrum across n points
      const spec = H.resample(f.spectrum, n, H.buf(c.st, 'sp', n));
      H.smoothArray(spec, n, Math.round((o.tension / 100) * 4), false);

      // Track persistent phase for flowing waves
      if (typeof c.st.phase !== 'number') c.st.phase = 0;
      c.st.phase += dt * speed * (1.2 + f.energy * 1.5);

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
      const baseAlpha = ctx.globalAlpha;

      for (let r = ribbonCount - 1; r >= 0; r--) {
        const layerRatio = r / Math.max(1, ribbonCount - 1);
        const layerPhase = c.st.phase + r * 1.35;
        const layerAlpha = 1 - layerRatio * 0.45;
        const layerAmp = maxH * (1 - layerRatio * 0.25);
        const beatBump = f.beat * (20 * (1 - layerRatio * 0.4));

        for (let i = 0; i < n; i++) {
          const t = i / (n - 1);
          // Wave dynamics modulated by real spectrum and energy
          const wave = Math.sin(t * (o.waviness * 0.15) + layerPhase) * (h * 0.08 * (0.4 + f.mid));
          const audioAmp = spec[i] * layerAmp + beatBump * Math.sin(t * Math.PI);
          const distort = H.distort(c, i * 0.12 + layerPhase) * h * 0.06;
          ys[i] = H.clamp(baseY - audioAmp - wave + distort, 4, h);
        }

        ctx.strokeStyle = grad;
        ctx.lineWidth = Math.max(1.5, (3 - layerRatio * 1.2) * (1 + f.bass * 0.8));
        ctx.globalAlpha = baseAlpha * layerAlpha;

        if (o.fill) {
          ctx.beginPath();
          ctx.moveTo(0, h);
          H.curve(ctx, xs, ys, n);
          ctx.lineTo(w, h);
          ctx.closePath();
          ctx.fillStyle = grad;
          ctx.globalAlpha = baseAlpha * (0.12 + (1 - layerRatio) * 0.16);
          ctx.fill();
          ctx.globalAlpha = baseAlpha * layerAlpha;
        }

        ctx.beginPath();
        H.curve(ctx, xs, ys, n);
        ctx.stroke();
      }

      ctx.restore();
    }
  });
})(typeof self !== 'undefined' ? self : this);
