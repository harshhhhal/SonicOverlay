(function (root) {
  'use strict';
  const SO = root.SO, K = SO.ctl;

  SO.registerVisualizer({
    id: 'plasma-orbit',
    name: 'Plasma Orbit',
    icon: 'plasma',
    layout: 'center',
    defaults: {
      orbits: 3,
      nodesPerOrbit: 4,
      tilt: 35,
      glow: 75,
      orbitSpeed: 90,
      connectLines: true
    },
    controls: [
      K.range('orbits', 'Orbit count', 2, 6),
      K.range('nodesPerOrbit', 'Nodes per orbit', 2, 8),
      K.range('tilt', 'Orbital tilt (°)', 10, 80),
      K.range('glow', 'Glow intensity', 0, 100),
      K.range('orbitSpeed', 'Orbit speed', 20, 200),
      K.toggle('connectLines', 'Inter-orbital chords')
    ],
    render(c) {
      const { ctx, w, h, f, o, H, dt } = c;
      const orbitCount = Math.round(H.clamp(o.orbits, 2, 6));
      const nodeCount = Math.round(H.clamp(o.nodesPerOrbit, 2, 8));
      const cx = w / 2;
      const cy = h / 2;
      const baseR = Math.min(w, h) * 0.38;
      const speed = c.rm ? 0 : (o.orbitSpeed / 100);
      const tiltRad = (o.tilt * Math.PI) / 180;

      if (!c.st.angles) c.st.angles = new Float32Array(6);
      const angles = c.st.angles;

      // Audio-reactive band multipliers
      const bands = [f.bass, f.mid, f.high, (f.bass + f.mid) / 2, (f.mid + f.high) / 2, f.energy];

      for (let i = 0; i < orbitCount; i++) {
        const bandVal = bands[i % bands.length];
        const dir = (i % 2 === 0 ? 1 : -1);
        angles[i] += dt * speed * dir * (0.8 + bandVal * 1.5);
      }

      ctx.save();
      const baseAlpha = c.s.color.opacity / 100;
      const primCol = (c.cs && c.cs.primary) || c.s.color.primary || '#00f0ff';
      const secCol = (c.cs && c.cs.secondary) || c.s.color.secondary || '#ff2bd6';

      if (o.glow > 0) {
        ctx.shadowColor = primCol;
        ctx.shadowBlur = (o.glow / 100) * 16 * c.dpr;
      }

      const allNodes = [];

      for (let k = 0; k < orbitCount; k++) {
        const bandVal = bands[k % bands.length];
        const orbitAngle = (k / orbitCount) * Math.PI + (c.rm ? 0 : c.time * 0.1);
        const rX = baseR * (0.6 + (k / orbitCount) * 0.45) * (1 + bandVal * 0.35 + (k === 0 ? f.beat * 0.2 : 0));
        const rY = rX * Math.cos(tiltRad);

        // Draw elliptical path
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(orbitAngle);

        ctx.strokeStyle = k % 2 === 0 ? primCol : secCol;
        ctx.lineWidth = Math.max(1, 1.8 * (1 + bandVal * 0.4));
        ctx.globalAlpha = baseAlpha * (0.35 + bandVal * 0.35);

        ctx.beginPath();
        ctx.ellipse(0, 0, rX, rY, 0, 0, H.TAU);
        ctx.stroke();

        // Calculate node positions along this ellipse
        const currentNodes = [];
        const baseRot = angles[k];
        for (let j = 0; j < nodeCount; j++) {
          const theta = baseRot + (j / nodeCount) * H.TAU;
          const localX = Math.cos(theta) * rX;
          const localY = Math.sin(theta) * rY;

          // Project back to canvas space
          const cosO = Math.cos(orbitAngle);
          const sinO = Math.sin(orbitAngle);
          const worldX = cx + localX * cosO - localY * sinO;
          const worldY = cy + localX * sinO + localY * cosO;

          currentNodes.push({ x: worldX, y: worldY, band: bandVal });
        }
        allNodes.push(currentNodes);
        ctx.restore();
      }

      // Draw subtle connecting chords between adjacent orbit nodes
      if (o.connectLines && allNodes.length >= 2) {
        ctx.strokeStyle = secCol;
        ctx.lineWidth = 1;
        ctx.globalAlpha = baseAlpha * (0.2 + f.energy * 0.3);
        for (let k = 0; k < allNodes.length - 1; k++) {
          const listA = allNodes[k];
          const listB = allNodes[k + 1];
          const pairs = Math.min(listA.length, listB.length);
          for (let j = 0; j < pairs; j++) {
            ctx.beginPath();
            ctx.moveTo(listA[j].x, listA[j].y);
            ctx.lineTo(listB[j].x, listB[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw glowing orbital nodes
      for (let k = 0; k < allNodes.length; k++) {
        const nodeList = allNodes[k];
        for (let j = 0; j < nodeList.length; j++) {
          const node = nodeList[j];
          const nodeRadius = Math.max(2.5, (4 + node.band * 7) * (1 + f.beat * 0.4));

          ctx.fillStyle = k % 2 === 0 ? primCol : secCol;
          ctx.globalAlpha = baseAlpha * Math.min(1, 0.75 + node.band * 0.5);

          ctx.beginPath();
          ctx.arc(node.x, node.y, nodeRadius, 0, H.TAU);
          ctx.fill();

          // Bright core
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(node.x, node.y, Math.max(1, nodeRadius * 0.4), 0, H.TAU);
          ctx.fill();
        }
      }

      ctx.restore();
    }
  });
})(typeof self !== 'undefined' ? self : this);
