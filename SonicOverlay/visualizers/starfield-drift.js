(function (root) {
  'use strict';
  const SO = root.SO, K = SO.ctl;

  // Simple deterministic LCG pseudo-random generator for consistent starfield seed
  function createRng(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function () {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  SO.registerVisualizer({
    id: 'starfield-drift',
    name: 'Starfield Drift',
    icon: 'stars',
    layout: 'full',
    defaults: {
      starCount: 160,
      driftSpeed: 100,
      trailLength: 40,
      burstIntensity: 65,
      centerWarp: true
    },
    controls: [
      K.range('starCount', 'Star count', 60, 350),
      K.range('driftSpeed', 'Drift speed', 20, 250),
      K.range('trailLength', 'Trail length', 0, 100),
      K.range('burstIntensity', 'Beat burst', 0, 100),
      K.toggle('centerWarp', 'Center warp aura')
    ],
    render(c) {
      const { ctx, w, h, f, o, H, dt } = c;
      const targetCount = Math.round(H.clamp(o.starCount, 40, 400));
      const cx = w / 2;
      const cy = h / 2;
      const maxDist = Math.hypot(cx, cy);

      // Initialize persistent stars array once
      if (!c.st.stars || c.st.stars.length !== targetCount) {
        const rng = createRng(1337);
        c.st.stars = [];
        for (let i = 0; i < targetCount; i++) {
          const angle = rng() * H.TAU;
          const dist = Math.sqrt(rng()) * maxDist;
          c.st.stars.push({
            x: Math.cos(angle) * dist,
            y: Math.sin(angle) * dist,
            z: 0.1 + rng() * 0.9, // depth: 1 = far, 0 = close
            size: 1 + rng() * 2,
            prevX: 0,
            prevY: 0
          });
        }
      }

      const stars = c.st.stars;
      const baseSpeed = c.rm ? 0 : (o.driftSpeed / 100) * 0.35;
      const burst = (o.burstIntensity / 100) * (f.beat * 1.8 + f.bass * 0.9);
      const effectiveSpeed = baseSpeed * (1 + burst + f.energy * 0.7);

      ctx.save();
      H.glowOn(c);

      const primCol = (c.cs && c.cs.primary) || c.s.color.primary || '#00f0ff';
      const secCol = (c.cs && c.cs.secondary) || c.s.color.secondary || '#ff2bd6';

      // Center warp core aura on beat
      if (o.centerWarp && (f.beat > 0.05 || f.energy > 0.2)) {
        const warpRad = (18 + f.bass * 42 + f.beat * 32) * (w / 1000 + 0.5);
        const radGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, warpRad);
        radGrad.addColorStop(0, primCol);
        radGrad.addColorStop(0.4, secCol);
        radGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = radGrad;
        ctx.globalAlpha = (c.s.color.opacity / 100) * (0.2 + f.beat * 0.3);
        ctx.beginPath();
        ctx.arc(cx, cy, warpRad, 0, H.TAU);
        ctx.fill();
      }

      ctx.strokeStyle = primCol;
      ctx.fillStyle = primCol;
      ctx.lineCap = 'round';
      const baseAlpha = c.s.color.opacity / 100;
      const trailFactor = (o.trailLength / 100) * (1 + burst * 0.5);

      for (let i = 0; i < targetCount; i++) {
        const s = stars[i];

        // Move star closer in z
        s.z -= dt * effectiveSpeed;
        if (s.z <= 0.02) {
          s.z += 1.0;
          // Spawn near center
          const angle = (i / targetCount) * H.TAU + (c.rm ? 0 : c.time * 0.1);
          const initDist = 10 + (i % 20) * 4;
          s.x = Math.cos(angle) * initDist;
          s.y = Math.sin(angle) * initDist;
          s.prevX = cx + s.x / s.z;
          s.prevY = cy + s.y / s.z;
        }

        // 3D perspective projection
        const k = 1 / s.z;
        const screenX = cx + s.x * (k * 0.45);
        const screenY = cy + s.y * (k * 0.45);

        // Reset if offscreen
        if (screenX < -20 || screenX > w + 20 || screenY < -20 || screenY > h + 20) {
          s.z = 1.0;
          continue;
        }

        const alpha = Math.min(1, (1 - s.z) * 1.4) * baseAlpha;
        const starSize = Math.max(1, s.size * (1 - s.z * 0.6) * (1 + f.energy * 0.6));

        // Draw trail if enabled
        if (trailFactor > 0 && s.prevX !== 0) {
          ctx.beginPath();
          ctx.lineWidth = Math.max(0.8, starSize * 0.6);
          ctx.globalAlpha = alpha * 0.55;
          ctx.moveTo(s.prevX, s.prevY);
          ctx.lineTo(screenX, screenY);
          ctx.stroke();
        }

        // Draw star head
        ctx.beginPath();
        ctx.globalAlpha = alpha;
        ctx.arc(screenX, screenY, starSize, 0, H.TAU);
        ctx.fill();

        // Update trail previous position with damping
        s.prevX = s.prevX + (screenX - s.prevX) * (1 - trailFactor * 0.7);
        s.prevY = s.prevY + (screenY - s.prevY) * (1 - trailFactor * 0.7);
      }

      ctx.restore();
    }
  });
})(typeof self !== 'undefined' ? self : this);
