(function (root) {
  'use strict';
  const SO = root.SO, K = SO.ctl;

  SO.registerVisualizer({
    id: 'orbiting-particles',
    name: 'Orbiting Particles',
    icon: 'orbitparticles',
    layout: 'center',
    defaults: {
      rings: 3,
      particlesPerRing: 24,
      orbitSpeed: 85,
      glow: 70,
      trails: true
    },
    controls: [
      K.range('rings', 'Orbital rings', 2, 6),
      K.range('particlesPerRing', 'Particles / ring', 12, 48),
      K.range('orbitSpeed', 'Orbit speed', 20, 200),
      K.range('glow', 'Glow intensity', 0, 100),
      K.toggle('trails', 'Motion trails')
    ],
    render(c) {
      const { ctx, w, h, f, o, H, dt } = c;
      const ringCount = Math.round(H.clamp(o.rings, 2, 6));
      const pCount = Math.round(H.clamp(o.particlesPerRing, 8, 48));
      const totalParticles = ringCount * pCount;
      const cx = w / 2;
      const cy = h / 2;
      const maxRadius = Math.min(w, h) * 0.45;
      const speed = c.rm ? 0 : (o.orbitSpeed / 100);

      // Initialize persistent particle pool once in c.st
      if (!c.st.particles || c.st.particles.length !== totalParticles) {
        c.st.particles = [];
        for (let r = 0; r < ringCount; r++) {
          for (let p = 0; p < pCount; p++) {
            c.st.particles.push({
              ring: r,
              angle: (p / pCount) * H.TAU,
              baseSize: 1.8 + (r % 3) * 0.8,
              prevX: 0,
              prevY: 0
            });
          }
        }
      }

      // Audio bands for orbital rings
      const bandEnergies = [
        f.bass,
        f.mid,
        f.high,
        (f.bass + f.mid) / 2,
        (f.mid + f.high) / 2,
        f.energy
      ];

      ctx.save();
      const baseAlpha = c.s.color.opacity / 100;
      const primCol = (c.cs && c.cs.primary) || c.s.color.primary || '#00f0ff';
      const secCol = (c.cs && c.cs.secondary) || c.s.color.secondary || '#ff2bd6';

      if (o.glow > 0) {
        ctx.shadowColor = primCol;
        ctx.shadowBlur = (o.glow / 100) * 16 * c.dpr;
      }

      // Draw faint orbital ring track guides
      ctx.lineWidth = 1;
      for (let r = 0; r < ringCount; r++) {
        const ringEnergy = bandEnergies[r % bandEnergies.length];
        const rFrac = (r + 1) / (ringCount + 0.5);
        const radius = rFrac * maxRadius * (1 + ringEnergy * 0.25 + (r === 0 ? f.beat * 0.15 : 0));

        ctx.strokeStyle = r % 2 === 0 ? primCol : secCol;
        ctx.globalAlpha = baseAlpha * (0.15 + ringEnergy * 0.2);
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, H.TAU);
        ctx.stroke();
      }

      // Update and draw particles
      ctx.lineCap = 'round';
      const particles = c.st.particles;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const r = p.ring;
        const ringEnergy = bandEnergies[r % bandEnergies.length];
        const dir = (r % 2 === 0 ? 1 : -1);

        // Update angle
        p.angle += dt * speed * dir * (0.6 + ringEnergy * 1.6 + (r / ringCount) * 0.4);

        const rFrac = (r + 1) / (ringCount + 0.5);
        const radius = rFrac * maxRadius * (1 + ringEnergy * 0.25 + (r === 0 ? f.beat * 0.15 : 0));
        const px = cx + Math.cos(p.angle) * radius;
        const py = cy + Math.sin(p.angle) * radius;

        const pSize = Math.max(1, p.baseSize * (1 + ringEnergy * 1.5 + (r === 0 ? f.beat * 0.8 : 0)));
        const col = r % 2 === 0 ? primCol : secCol;

        // Draw particle trail
        if (o.trails && p.prevX !== 0) {
          ctx.strokeStyle = col;
          ctx.lineWidth = Math.max(0.8, pSize * 0.6);
          ctx.globalAlpha = baseAlpha * 0.35;
          ctx.beginPath();
          ctx.moveTo(p.prevX, p.prevY);
          ctx.lineTo(px, py);
          ctx.stroke();
        }

        // Draw particle head
        ctx.fillStyle = col;
        ctx.globalAlpha = baseAlpha * (0.6 + ringEnergy * 0.4);
        ctx.beginPath();
        ctx.arc(px, py, pSize, 0, H.TAU);
        ctx.fill();

        // Update previous coords with gentle smoothing
        p.prevX = p.prevX ? p.prevX + (px - p.prevX) * 0.4 : px;
        p.prevY = p.prevY ? p.prevY + (py - p.prevY) * 0.4 : py;
      }

      ctx.restore();
    }
  });
})(typeof self !== 'undefined' ? self : this);
