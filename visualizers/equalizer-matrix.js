(function (root) {
  'use strict';
  const SO = root.SO, K = SO.ctl;

  SO.registerVisualizer({
    id: 'equalizer-matrix',
    name: 'Equalizer Matrix',
    icon: 'matrix',
    layout: 'bottom',
    defaults: {
      columns: 32,
      rows: 12,
      cellShape: 'rounded',
      cellGap: 2,
      peaks: true,
      peakDecay: 60
    },
    controls: [
      K.range('columns', 'Columns', 12, 64),
      K.range('rows', 'Rows', 6, 24),
      K.select('cellShape', 'LED shape', [
        ['rounded', 'Rounded Rect'],
        ['square', 'Square'],
        ['circle', 'Dot']
      ]),
      K.range('cellGap', 'Cell gap', 1, 6),
      K.toggle('peaks', 'Peak indicators'),
      K.range('peakDecay', 'Peak decay', 10, 100)
    ],
    render(c) {
      const { ctx, w, h, f, o, H, dt } = c;
      const cols = Math.round(H.clamp(o.columns, 8, 64));
      const rows = Math.round(H.clamp(o.rows, 4, 32));
      const gap = H.clamp(o.cellGap, 1, 8);

      const cellW = (w - (cols - 1) * gap) / cols;
      const cellH = (h - (rows - 1) * gap) / rows;
      if (cellW <= 0.5 || cellH <= 0.5) return;

      const spec = H.resample(f.spectrum, cols, H.buf(c.st, 'sp', cols));

      // Calculate peak hold values
      const peaks = o.peaks ? H.peaks(c, 'pk', spec, cols) : null;

      ctx.save();
      const baseAlpha = c.s.color.opacity / 100;
      const grad = H.grad(c);
      H.glowOn(c);

      const shape = o.cellShape;
      const radius = Math.min(cellW, cellH) * 0.25;

      for (let x = 0; x < cols; x++) {
        const val = spec[x];
        const activeRows = Math.round(val * rows);
        const peakRow = peaks ? Math.min(rows - 1, Math.round(peaks[x] * rows)) : -1;
        const posX = x * (cellW + gap);

        for (let y = 0; y < rows; y++) {
          // Bottom-up: y=0 is bottom row, y=rows-1 is top row
          const posY = h - (y + 1) * (cellH + gap) + gap;
          const isActive = y < activeRows;
          const isPeak = o.peaks && y === peakRow && peakRow > 0;

          if (!isActive && !isPeak) {
            // Draw faint unlit LED background dot for hardware aesthetic
            ctx.save();
            H.glowOff(ctx);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            if (shape === 'circle') {
              ctx.beginPath();
              ctx.arc(posX + cellW / 2, posY + cellH / 2, Math.min(cellW, cellH) / 2, 0, H.TAU);
              ctx.fill();
            } else if (shape === 'rounded') {
              H.rrect(ctx, posX, posY, cellW, cellH, radius);
              ctx.fill();
            } else {
              ctx.fillRect(posX, posY, cellW, cellH);
            }
            ctx.restore();
            continue;
          }

          // Lit LED
          ctx.fillStyle = grad;
          ctx.globalAlpha = baseAlpha * (isPeak && !isActive ? 1.0 : (0.7 + (y / rows) * 0.3));

          if (shape === 'circle') {
            ctx.beginPath();
            ctx.arc(posX + cellW / 2, posY + cellH / 2, Math.min(cellW, cellH) / 2, 0, H.TAU);
            ctx.fill();
          } else if (shape === 'rounded') {
            H.rrect(ctx, posX, posY, cellW, cellH, radius);
            ctx.fill();
          } else {
            ctx.fillRect(posX, posY, cellW, cellH);
          }
        }
      }

      ctx.restore();
    }
  });
})(typeof self !== 'undefined' ? self : this);
