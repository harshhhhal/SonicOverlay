(function (root) {
  'use strict';
  const SO = root.SO, K = SO.ctl;

  SO.registerVisualizer({
    id: 'glitch-spectrum',
    name: 'Glitch Spectrum',
    icon: 'glitch',
    layout: 'bottom',
    defaults: {
      barCount: 48,
      glitchAmount: 45,
      scanlines: true,
      rgbSplit: true,
      barSpacing: 2
    },
    controls: [
      K.range('barCount', 'Bar count', 16, 96),
      K.range('glitchAmount', 'Glitch intensity', 0, 100),
      K.toggle('scanlines', 'CRT scan lines'),
      K.toggle('rgbSplit', 'Chromatic RGB split'),
      K.range('barSpacing', 'Bar spacing', 1, 8)
    ],
    render(c) {
      const { ctx, w, h, f, o, H, dt } = c;
      const n = Math.round(H.clamp(o.barCount, 16, 96));
      const sp = H.clamp(o.barSpacing, 0, 8);
      const totalSpacing = (n - 1) * sp;
      const bw = Math.max(1.5, (w - totalSpacing) / n);
      const maxH = h * 0.9;

      const spec = H.resample(f.spectrum, n, H.buf(c.st, 'sp', n));

      // Glitch impulse state driven by beat and energy
      if (typeof c.st.glitchHold !== 'number') {
        c.st.glitchHold = 0;
        c.st.sliceY = 0.5;
        c.st.sliceH = 0.2;
        c.st.sliceOffset = 0;
      }

      // Natural decay of glitch impulse
      c.st.glitchHold = Math.max(0, c.st.glitchHold - dt * 3.5);

      // Trigger sparse glitch slice on sharp beat or high energy peaks
      if (f.beat > 0.65 && c.st.glitchHold < 0.1) {
        c.st.glitchHold = 1.0;
        // Deterministic slice parameters based on time & beat
        c.st.sliceY = ((c.time * 7.3) % 1) * 0.6 + 0.1;
        c.st.sliceH = 0.1 + ((c.time * 3.1) % 1) * 0.2;
        const dir = (Math.sin(c.time * 15) > 0 ? 1 : -1);
        c.st.sliceOffset = dir * (12 + f.energy * 24) * (o.glitchAmount / 100);
      }

      ctx.save();
      const baseAlpha = c.s.color.opacity / 100;
      const grad = H.grad(c);
      H.glowOn(c);

      const activeGlitch = c.st.glitchHold * (o.glitchAmount / 100);
      const sliceTop = c.st.sliceY * h;
      const sliceBot = (c.st.sliceY + c.st.sliceH) * h;
      const xOffset = c.st.sliceOffset * activeGlitch;

      // Draw chromatic aberration passes if enabled and glitch active
      if (o.rgbSplit && activeGlitch > 0.15) {
        // Red channel offset
        ctx.save();
        ctx.fillStyle = 'rgba(255, 40, 40, 0.55)';
        for (let i = 0; i < n; i++) {
          let x = i * (bw + sp) + xOffset * 0.6;
          const bh = spec[i] * maxH;
          const y = h - bh;
          if (bh > 1) ctx.fillRect(x - 2, y, bw, bh);
        }
        ctx.restore();

        // Cyan channel offset
        ctx.save();
        ctx.fillStyle = 'rgba(0, 240, 255, 0.55)';
        for (let i = 0; i < n; i++) {
          let x = i * (bw + sp) - xOffset * 0.6;
          const bh = spec[i] * maxH;
          const y = h - bh;
          if (bh > 1) ctx.fillRect(x + 2, y, bw, bh);
        }
        ctx.restore();
      }

      // Draw main spectrum bars with slice displacement
      ctx.fillStyle = grad;
      ctx.globalAlpha = baseAlpha;

      for (let i = 0; i < n; i++) {
        let x = i * (bw + sp);
        const bh = spec[i] * maxH;
        const y = h - bh;

        if (bh <= 1) continue;

        // Apply slice offset if bar intersects the glitch band
        if (activeGlitch > 0.05 && y < sliceBot && (y + bh) > sliceTop) {
          x += xOffset;
        }

        ctx.fillRect(x, y, bw, bh);
      }

      // Draw CRT horizontal scan lines if enabled
      if (o.scanlines) {
        ctx.save();
        H.glowOff(ctx);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        const lineSpacing = 4;
        for (let y = 0; y < h; y += lineSpacing) {
          ctx.fillRect(0, y, w, 1);
        }
        ctx.restore();
      }

      ctx.restore();
    }
  });
})(typeof self !== 'undefined' ? self : this);
