(function (root) {
  'use strict';
  const SO = root.SO, K = SO.ctl;

  SO.registerVisualizer({
    id: 'vortex-tunnel',
    name: 'Vortex Tunnel',
    icon: 'vortex',
    layout: 'center',
    defaults: {
      ringCount: 12,
      sides: '6',
      twist: 40,
      bassExpand: 80,
      speed: 100,
      spokes: false
    },
    controls: [
      K.range('ringCount', 'Tunnel rings', 6, 24),
      K.select('sides', 'Geometry', [
        ['circle', 'Circle'],
        ['3', 'Triangle'],
        ['4', 'Square'],
        ['6', 'Hexagon'],
        ['8', 'Octagon']
      ]),
      K.range('twist', 'Tunnel twist', 0, 100),
      K.range('bassExpand', 'Bass pulse', 10, 150),
      K.range('speed', 'Tunnel speed', 20, 200),
      K.toggle('spokes', 'Perspective spokes')
    ],
    render(c) {
      const { ctx, w, h, f, o, H, dt } = c;
      const ringCount = Math.round(H.clamp(o.ringCount, 4, 32));
      const cx = w / 2;
      const cy = h / 2;
      const maxRadius = Math.min(w, h) * 0.48;
      const speed = c.rm ? 0 : (o.speed / 100);

      // Track tunnel progress
      if (typeof c.st.progress !== 'number') c.st.progress = 0;
      c.st.progress += dt * speed * (0.6 + f.energy * 0.8);
      const prog = c.st.progress % 1;

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      H.glowOn(c);

      const grad = H.grad(c);
      ctx.strokeStyle = grad;
      const baseAlpha = ctx.globalAlpha;
      const isCircle = o.sides === 'circle';
      const numSides = isCircle ? 32 : parseInt(o.sides, 10) || 6;
      const twistFactor = (o.twist / 100) * 1.5;
      const bassAmp = (o.bassExpand / 100) * (f.bass * 0.45 + f.beat * 0.35);

      // Store corner points of closest and furthest rings for spokes
      const spokePoints = [];

      for (let r = 0; r < ringCount; r++) {
        // Perspective depth z from 0 (vanishing center) to 1 (near viewer)
        const z = ((r + prog) / ringCount) % 1;
        // Non-linear perspective scaling: z^1.8
        const pz = Math.pow(z, 1.8);
        const radius = pz * maxRadius * (1 + bassAmp);

        if (radius < 3) continue;

        const ringAlpha = Math.min(1, pz * 1.5) * (1 - pz * 0.2);
        ctx.globalAlpha = baseAlpha * ringAlpha;
        ctx.lineWidth = Math.max(1, pz * 3.5 * (1 + f.bass * 0.5));

        const rot = (1 - z) * twistFactor * Math.PI + (c.rm ? 0 : c.time * 0.2);

        ctx.beginPath();
        const pts = [];
        for (let i = 0; i < numSides; i++) {
          const a = (i / numSides) * H.TAU + rot;
          // Subtly modulate radius with frequency spectrum bins
          const specIdx = Math.floor((i / numSides) * 32);
          const fBump = (f.spectrum[specIdx] || 0) * (radius * 0.12);
          const rad = radius + fBump;
          const px = cx + Math.cos(a) * rad;
          const py = cy + Math.sin(a) * rad;
          pts.push({ x: px, y: py });
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();

        if (o.spokes && (r === 0 || r === ringCount - 1)) {
          spokePoints.push(pts);
        }
      }

      // Draw connecting longitudinal perspective spokes if requested
      if (o.spokes && spokePoints.length >= 2) {
        ctx.globalAlpha = baseAlpha * 0.35;
        ctx.lineWidth = 1;
        const inner = spokePoints[0];
        const outer = spokePoints[spokePoints.length - 1];
        for (let i = 0; i < numSides; i += 1) {
          ctx.beginPath();
          ctx.moveTo(inner[i].x, inner[i].y);
          ctx.lineTo(outer[i].x, outer[i].y);
          ctx.stroke();
        }
      }

      ctx.restore();
    }
  });
})(typeof self !== 'undefined' ? self : this);
