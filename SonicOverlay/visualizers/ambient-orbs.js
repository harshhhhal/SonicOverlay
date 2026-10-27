(function (root) {
  'use strict';
  const SO = root.SO, K = SO.ctl;
  SO.registerVisualizer({
    id: 'ambient-orbs', name: 'Ambient Orbs', icon: 'orbs', layout: 'full',
    defaults: { orbCount: 7, baseSize: 24, softness: 60, motion: 30, additive: true, background: '#05060a', backgroundOpacity: 0 },
    controls: [K.range('orbCount', 'Orb count', 2, 14), K.range('baseSize', 'Orb size (%)', 6, 60), K.range('softness', 'Blur / softness', 0, 100), K.range('motion', 'Drift', 0, 100),
      K.toggle('additive', 'Additive glow'), K.color('background', 'Background color'), K.range('backgroundOpacity', 'Background opacity (%)', 0, 100)],
    render(c) {
      const { ctx, w, h, f, o, H } = c, n = Math.round(o.orbCount), R = Math.min(w, h), base = ctx.globalAlpha;
      ctx.save();
      try {
        if (o.backgroundOpacity > 0) { ctx.globalAlpha = base * o.backgroundOpacity / 100; ctx.fillStyle = o.background; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = base; }
        if (o.additive) ctx.globalCompositeOperation = 'lighter';
        const drift = o.motion / 100 * (c.rm ? 0.2 : 1), lv = [f.bass, f.mid * 1.6, f.high * 2.4];
        for (let i = 0; i < n; i++) {
          const level = Math.min(1, lv[i % 3]), ang = i * 2.399963;
          const x = w * (0.5 + 0.32 * Math.cos(ang)) + Math.sin(c.time * (0.15 + i * 0.037) + i) * w * 0.08 * drift;
          const y = h * (0.5 + 0.28 * Math.sin(ang)) + Math.cos(c.time * (0.12 + i * 0.041) + i * 2) * h * 0.08 * drift;
          const r = Math.max(1, R * o.baseSize / 100 * (0.6 + 0.4 * (i % 3) / 2) * (1 + level * 0.9));
          const a = H.clamp(0.07 + level * 0.75, 0, 0.85), rgb = c.cs.at(n > 1 ? i / (n - 1) : 0), mid = 0.3 + 0.4 * (1 - o.softness / 100);
          const g = ctx.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, SO.Color.rgba(rgb, a)); g.addColorStop(mid, SO.Color.rgba(rgb, a * 0.55)); g.addColorStop(1, SO.Color.rgba(rgb, 0));
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, H.TAU); ctx.fill();
        }
      } finally {
        ctx.restore();
      }
    }
  });
})(typeof self !== 'undefined' ? self : this);
