(function (root) {
  'use strict';
  const SO = root.SO, K = SO.ctl;

  SO.registerVisualizer({
    id: 'concentric-pulse',
    name: 'Concentric Pulse',
    icon: 'pulse',
    layout: 'center',
    defaults: {
      maxRings: 8,
      expansionSpeed: 85,
      strokeWidth: 2,
      ticks: true,
      bassReact: 65,
      fadeRate: 50
    },
    controls: [
      K.range('maxRings', 'Max ring pulses', 4, 16),
      K.range('expansionSpeed', 'Expansion speed', 30, 200),
      K.range('strokeWidth', 'Ring thickness', 1, 8),
      K.toggle('ticks', 'Radial tick markers'),
      K.range('bassReact', 'Bass sensitivity', 10, 100),
      K.range('fadeRate', 'Decay rate', 20, 100)
    ],
    render(c) {
      const { ctx, w, h, f, o, H, dt } = c;
      const maxRings = Math.round(H.clamp(o.maxRings, 3, 20));
      const cx = w / 2;
      const cy = h / 2;
      const maxRadius = Math.min(w, h) * 0.48;
      const speed = c.rm ? 20 : (o.expansionSpeed / 100) * 120;
      const bassEnergy = f.bass * (o.bassReact / 100);

      if (!c.st.rings) c.st.rings = [];
      const rings = c.st.rings;

      // Spawn new ring on beat or strong bass transient
      if (typeof c.st.lastSpawn !== 'number') c.st.lastSpawn = 0;
      c.st.lastSpawn += dt;

      const trigger = (f.beat > 0.4 || bassEnergy > 0.6) && c.st.lastSpawn > 0.14;
      if (trigger && rings.length < maxRings) {
        c.st.lastSpawn = 0;
        rings.push({
          radius: 12 + bassEnergy * 24,
          alpha: 1.0,
          energy: bassEnergy,
          initialBass: f.bass
        });
      }

      ctx.save();
      ctx.lineCap = 'round';
      H.glowOn(c);

      const grad = H.grad(c);
      ctx.strokeStyle = grad;
      const baseAlpha = c.s.color.opacity / 100;
      const fadeDecay = (o.fadeRate / 100) * 1.2;

      // Update and draw active rings
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.radius += dt * speed * (0.8 + r.energy * 0.6);
        const progress = r.radius / maxRadius;
        r.alpha = Math.max(0, 1 - Math.pow(progress, 1.2)) * Math.exp(-fadeDecay * progress);

        if (progress >= 1 || r.alpha <= 0.02) {
          rings.splice(i, 1);
          continue;
        }

        ctx.globalAlpha = baseAlpha * r.alpha;
        ctx.lineWidth = Math.max(1, o.strokeWidth * (1 + (1 - progress) * 1.5 * r.initialBass));

        ctx.beginPath();
        ctx.arc(cx, cy, r.radius, 0, H.TAU);
        ctx.stroke();

        // Optional fine tick markers along the ring
        if (o.ticks && progress > 0.15) {
          const tickCount = 24;
          const tickLen = 4 + (1 - progress) * 6;
          ctx.lineWidth = 1;
          for (let t = 0; t < tickCount; t++) {
            const angle = (t / tickCount) * H.TAU + (c.rm ? 0 : c.time * 0.05);
            const r0 = r.radius - tickLen / 2;
            const r1 = r.radius + tickLen / 2;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(angle) * r0, cy + Math.sin(angle) * r0);
            ctx.lineTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1);
            ctx.stroke();
          }
        }
      }

      // Draw central calm anchor node pulsing with bass
      const centerR = 6 + f.bass * 14 + f.beat * 8;
      ctx.globalAlpha = baseAlpha * (0.7 + f.energy * 0.3);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, centerR, 0, H.TAU);
      ctx.fill();

      ctx.restore();
    }
  });
})(typeof self !== 'undefined' ? self : this);
