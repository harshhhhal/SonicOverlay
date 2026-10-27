(function (root) {
  'use strict';
  const SO = root.SO, K = SO.ctl;

  SO.registerVisualizer({
    id: 'frequency-mountain',
    name: 'Frequency Mountain',
    icon: 'mountain',
    layout: 'bottom',
    defaults: {
      layers: 3,
      peakHeight: 95,
      roughness: 45,
      fillOpacity: 55,
      wireframe: false,
      points: 64
    },
    controls: [
      K.range('layers', 'Depth layers', 2, 5),
      K.range('peakHeight', 'Peak height', 20, 200),
      K.range('roughness', 'Roughness', 10, 100),
      K.range('fillOpacity', 'Fill opacity', 10, 100),
      K.toggle('wireframe', 'Wireframe outline only'),
      K.range('points', 'Resolution', 32, 128)
    ],
    render(c) {
      const { ctx, w, h, f, o, H, dt } = c;
      const n = Math.round(H.clamp(o.points, 24, 128));
      const layerCount = Math.round(H.clamp(o.layers, 2, 5));
      const maxH = (o.peakHeight / 100) * (h * 0.78);
      const baseY = h * 0.96;
      const rough = o.roughness / 100;

      // Resample whole spectrum
      const spec = H.resample(f.spectrum, n, H.buf(c.st, 'sp', n));

      const xs = H.buf(c.st, 'x', n);
      const ys = H.buf(c.st, 'y', n);
      for (let i = 0; i < n; i++) {
        xs[i] = (i / (n - 1)) * w;
      }

      ctx.save();
      const baseAlpha = ctx.globalAlpha;
      H.glowOn(c);

      // Render layers from back (furthest) to front (closest)
      for (let lay = layerCount - 1; lay >= 0; lay--) {
        const depth = lay / (layerCount - 1); // 1 = back, 0 = front
        const depthScale = 1 - depth * 0.35;
        const layerAlpha = (1 - depth * 0.45);
        const shiftY = (lay / layerCount) * (h * 0.14);

        // Smooth buffer according to depth (further layers are softer)
        const smoothPasses = Math.round(1 + depth * 3 * (1 - rough * 0.5));
        const layerSpec = H.buf(c.st, 'lsp' + lay, n);
        layerSpec.set(spec);
        if (smoothPasses > 0) H.smoothArray(layerSpec, n, smoothPasses, false);

        for (let i = 0; i < n; i++) {
          const t = i / (n - 1);
          // Frequency mapping: each layer focuses on different harmonic depths
          const freqVal = layerSpec[i];
          const envelope = Math.sin(t * Math.PI); // tapering at edges for clean landscape
          const audioElevation = freqVal * maxH * depthScale * envelope;
          const ridgeDetail = rough * Math.sin(i * 1.7 + lay * 2.1) * (audioElevation * 0.2);

          ys[i] = H.clamp(baseY - audioElevation - ridgeDetail - shiftY, 6, h);
        }

        const grad = H.grad(c);
        ctx.strokeStyle = grad;
        ctx.lineWidth = Math.max(1, (2.8 - depth * 1.4) * (1 + (lay === 0 ? f.bass * 0.5 : 0)));
        ctx.globalAlpha = baseAlpha * layerAlpha;

        if (!o.wireframe) {
          ctx.beginPath();
          ctx.moveTo(0, h);
          H.curve(ctx, xs, ys, n);
          ctx.lineTo(w, h);
          ctx.closePath();
          ctx.fillStyle = grad;
          ctx.globalAlpha = baseAlpha * (o.fillOpacity / 100) * (0.35 + (1 - depth) * 0.65);
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
