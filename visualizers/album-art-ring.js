(function (root) {
  'use strict';
  const SO = root.SO, K = SO.ctl;
  SO.registerVisualizer({
    id: 'album-art-ring', name: 'Album Art Ring', icon: 'ring', layout: 'ring', drawsMeta: true, drawsWhenIdle: true,
    defaults: { barCount: 96, ringGap: 14, barLength: 100, lineThickness: 3, artBorder: true, borderWidth: 3, artGlow: true, spin: false, spinSpeed: 6, symmetrical: true },
    controls: [K.range('barCount', 'Bar count', 24, 240), K.range('ringGap', 'Gap to artwork (px)', 0, 60), K.range('barLength', 'Bar length (%)', 10, 100), K.range('lineThickness', 'Bar thickness', 1, 12),
      K.toggle('artBorder', 'Artwork border'), K.range('borderWidth', 'Border width', 1, 12), K.toggle('artGlow', 'Artwork glow'), K.toggle('spin', 'Spin artwork'),
      K.range('spinSpeed', 'Spin speed (deg/s)', 1, 60), K.toggle('symmetrical', 'Symmetrical bars')],
    render(c) {
      const { ctx, w, h, f, o, H, s, meta } = c, cx = w / 2, cy = h / 2, half = Math.min(w, h) / 2;
      const artR = Math.max(10, Math.min(s.meta.showArt ? s.meta.artSize / 2 : half * 0.28, half * 0.62)) * (1 + f.bass * 0.025);
      const r0 = artR + o.ringGap, L = Math.max(4, (half - r0) * o.barLength / 100), n = Math.round(o.barCount);
      const m = o.symmetrical ? Math.ceil(n / 2) : n, vals = H.resample(f.spectrum, m, H.buf(c.st, 'v', m));
      c.st.spin = (c.st.spin || 0) + (c.rm || !o.spin ? 0 : c.dt * o.spinSpeed * Math.PI / 180);
      c.st.rot = (c.st.rot || 0) + (c.rm ? 0 : c.dt * 0.12);

      ctx.lineWidth = o.lineThickness; ctx.lineCap = 'round'; ctx.strokeStyle = H.grad(c); H.glowOn(c);
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const v = o.symmetrical ? vals[i < m ? i : n - 1 - i] : vals[i], len = v * L; if (len < 0.5) continue;
        const a = -Math.PI / 2 + c.st.rot + i / n * H.TAU, ca = Math.cos(a), sa = Math.sin(a);
        ctx.moveTo(cx + ca * r0, cy + sa * r0); ctx.lineTo(cx + ca * (r0 + len), cy + sa * (r0 + len));
      }
      ctx.stroke(); H.glowOff(ctx);

      if (s.meta.showArt) {
        const img = c.art && c.art.img;
        if (o.artGlow) { ctx.save(); ctx.shadowBlur = (14 + f.bass * 26) * c.dpr; ctx.shadowColor = c.cs.css(0.4, 0.55); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(cx, cy, artR, 0, H.TAU); ctx.fill(); ctx.restore(); }
        ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, artR, 0, H.TAU); ctx.clip();
        if (img && img.naturalWidth) {
          ctx.translate(cx, cy); ctx.rotate(c.st.spin);
          const sz = Math.min(img.naturalWidth, img.naturalHeight), sx = (img.naturalWidth - sz) / 2, sy = (img.naturalHeight - sz) / 2;
          ctx.drawImage(img, sx, sy, sz, sz, -artR, -artR, artR * 2, artR * 2);
        } else { ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(cx - artR, cy - artR, artR * 2, artR * 2); }
        ctx.restore();
        if (o.artBorder) { ctx.lineWidth = o.borderWidth; ctx.strokeStyle = c.cs.css(0.5, 0.9); ctx.beginPath(); ctx.arc(cx, cy, artR, 0, H.TAU); ctx.stroke(); }
      }
      const R = r0 + L;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-c.s.layout.rotation * Math.PI / 180);
      ctx.translate(-cx, -cy);
      H.drawMeta(c, cx - R, cy - R, R * 2, R * 2, h);
      ctx.restore();
    }
  });
})(typeof self !== 'undefined' ? self : this);
