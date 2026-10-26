/* SonicOverlay - drawing helpers shared by all visualizers. */
(function (root) {
  'use strict';
  const SO = (root.SO = root.SO || {});
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const H = (SO.H = { TAU, clamp });

  const FONTS = {
    system: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', serif: 'Georgia, "Times New Roman", serif',
    mono: 'ui-monospace, Consolas, "SF Mono", monospace', rounded: '"Trebuchet MS", "Segoe UI", sans-serif', condensed: '"Arial Narrow", "Roboto Condensed", sans-serif'
  };

  H.buf = function (st, key, n) { let b = st[key]; if (!b || b.length !== n) { b = new Float32Array(n); st[key] = b; } return b; };

  /** Resample a spectrum to n values; preserves peaks when shrinking. */
  H.resample = function (src, n, dst) {
    const L = src.length;
    for (let i = 0; i < n; i++) {
      const a = i * L / n, b = (i + 1) * L / n;
      if (b - a <= 1) { const p = n > 1 ? i * (L - 1) / (n - 1) : 0, k = Math.floor(p), fr = p - k; dst[i] = src[k] * (1 - fr) + src[Math.min(L - 1, k + 1)] * fr; }
      else { let m = 0; for (let k = Math.floor(a); k < Math.min(L, Math.ceil(b)); k++) if (src[k] > m) m = src[k]; dst[i] = m; }
    }
    return dst;
  };

  H.rrect = function (ctx, x, y, w, h, r) {
    if (r > 0.5 && ctx.roundRect) ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2)); else ctx.rect(x, y, w, h);
  };

  H.grad = function (c, a) { return c.cs.gradient(c.ctx, c.w, c.h, c.s.color.gradientAngle, a === undefined ? 1 : a); };

  H.glowOn = function (c, mul) {
    const col = c.s.color, ctx = c.ctx;
    if (col.glowIntensity > 0 && col.glowRadius > 0) { ctx.shadowBlur = col.glowRadius * c.dpr; ctx.shadowColor = c.cs.css(0.5, clamp(col.glowIntensity / 100 * (mul || 1), 0, 1)); ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; }
    else if (col.shadow) { ctx.shadowBlur = 8 * c.dpr; ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowOffsetY = 3 * c.dpr; }
  };
  H.glowOff = function (ctx) { ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; };

  /** Peak-hold tracker. Returns array of peak values (same units as vals). */
  H.peaks = function (c, key, vals, n) {
    const pk = H.buf(c.st, key + 'P', n), tm = H.buf(c.st, key + 'T', n);
    const hold = c.s.audio.peakHold / 100 * 1.2, fall = 0.9;
    for (let i = 0; i < n; i++) {
      if (vals[i] >= pk[i]) { pk[i] = vals[i]; tm[i] = 0; }
      else { tm[i] += c.dt; if (tm[i] > hold) pk[i] = Math.max(vals[i], pk[i] - c.dt * fall); }
    }
    return pk;
  };

  /** Smooth curve through points using quadratic mid-point joins. xs/ys arrays, n points. */
  H.curve = function (ctx, xs, ys, n, close) {
    if (n < 2) return;
    ctx.moveTo(xs[0], ys[0]);
    for (let i = 1; i < n - 1; i++) ctx.quadraticCurveTo(xs[i], ys[i], (xs[i] + xs[i + 1]) / 2, (ys[i] + ys[i + 1]) / 2);
    ctx.lineTo(xs[n - 1], ys[n - 1]);
    if (close) ctx.closePath();
  };
  H.curveClosed = function (ctx, xs, ys, n) {
    ctx.moveTo((xs[n - 1] + xs[0]) / 2, (ys[n - 1] + ys[0]) / 2);
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; ctx.quadraticCurveTo(xs[i], ys[i], (xs[i] + xs[j]) / 2, (ys[i] + ys[j]) / 2); }
    ctx.closePath();
  };

  H.smoothArray = function (arr, n, passes, circular) {
    for (let p = 0; p < passes; p++) {
      let prev = arr[circular ? n - 1 : 0];
      const first = arr[0];
      for (let i = 0; i < n; i++) {
        const cur = arr[i], next = i < n - 1 ? arr[i + 1] : (circular ? first : arr[i]);
        arr[i] = (prev + 2 * cur + next) / 4; prev = cur;
      }
    }
  };

  H.distort = (c, phase) => (c.rm ? 0 : c.s.effects.waveDistortion / 100 * Math.sin(phase + c.time * 2));

  H.fitText = function (ctx, text, maxW) {
    if (ctx.measureText(text).width <= maxW) return text;
    let lo = 0, hi = text.length;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (ctx.measureText(text.slice(0, mid) + '\u2026').width <= maxW) lo = mid; else hi = mid - 1; }
    return text.slice(0, lo) + '\u2026';
  };

  /** Draw title / artist / progress near rect (x,y,w,h) in the current coordinate space. */
  H.drawMeta = function (c, x, y, w, h, viewH) {
    const m = c.s.meta, md = c.meta; if (!md) return;
    const fs = m.fontSize, lines = [];
    if (m.showTitle && md.title) lines.push({ t: md.title, size: fs, weight: m.fontWeight, a: 1 });
    if (m.showArtist && md.artist) lines.push({ t: md.artist, size: fs * 0.72, weight: Math.min(500, m.fontWeight), a: 0.8 });
    if (m.showProgress && md.duration > 0) lines.push({ t: SO.Util.fmtTime(md.position || 0) + ' / ' + SO.Util.fmtTime(md.duration), size: fs * 0.6, weight: 500, a: 0.65 });
    if (!lines.length) return;
    const total = lines.reduce((s, l) => s + l.size * 1.3, 0);
    let ty = m.textPlacement === 'above' ? y - 10 - total : m.textPlacement === 'center' ? y + h / 2 - total / 2 : y + h + 10;
    if (viewH) ty = clamp(ty, 6, Math.max(6, viewH - 6 - total));
    const ax = m.textAlign === 'left' ? x : m.textAlign === 'right' ? x + w : x + w / 2;
    const ctx = c.ctx, maxW = Math.max(220, w), base = ctx.globalAlpha;
    if (m.textShadow) { ctx.shadowColor = 'rgba(0,0,0,0.65)'; ctx.shadowBlur = 8 * c.dpr; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 1 * c.dpr; }
    else { ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; }
    for (const l of lines) {
      ctx.globalAlpha = base * l.a; ctx.font = l.weight + ' ' + l.size + 'px ' + FONTS[m.fontFamily];
      ctx.fillText(H.fitText(ctx, l.t, maxW), ax, ty); ty += l.size * 1.3;
    }
    ctx.restore();
  };

  /** Static glyphs for the visualizer picker (illustrations of each style, not live data). */
  H.icon = function (type, ctx, w, h, col) {
    ctx.clearRect(0, 0, w, h); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.lineCap = 'round';
    const cx = w / 2, cy = h / 2, hs = [0.35, 0.7, 0.5, 0.9, 0.6, 0.8, 0.4];
    const bars = (mirror, thin, rows) => {
      const n = 7, bw = w / (n * 1.6);
      hs.forEach((v, i) => {
        const x = 4 + i * ((w - 8) / n) + 1;
        if (rows) { for (let r = 0; r < 4; r++) if (r / 4 < v) { ctx.beginPath(); ctx.rect(x, h - 5 - (r + 1) * (h - 10) / 4 + 1, bw, (h - 10) / 4 - 2); ctx.fill(); } }
        else if (mirror) ctx.fillRect(x, cy - v * (h / 2 - 3), bw, v * (h - 6)); else ctx.fillRect(x, h - 3 - v * (h - 6), thin ? 2 : bw, v * (h - 6));
      });
    };
    switch (type) {
      case 'bars': bars(false); break;
      case 'mirror': bars(true); break;
      case 'eq': bars(false, true); break;
      case 'stack': bars(false, false, true); break;
      case 'radial': for (let i = 0; i < 16; i++) { const a = i / 16 * TAU, r0 = 7, r1 = 7 + 4 + hs[i % 7] * 7; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.stroke(); } break;
      case 'circwave': ctx.beginPath(); for (let i = 0; i <= 48; i++) { const a = i / 48 * TAU, r = 10 + Math.sin(a * 5) * 3; i ? ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r) : ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } ctx.stroke(); break;
      case 'linwave': ctx.beginPath(); for (let i = 0; i <= 40; i++) { const x = 3 + i / 40 * (w - 6), y = cy + Math.sin(i * 0.7) * Math.sin(i * 0.2 + 1) * 9; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); break;
      case 'curve': ctx.beginPath(); ctx.moveTo(3, h - 4); for (let i = 0; i <= 30; i++) ctx.lineTo(3 + i / 30 * (w - 6), h - 5 - Math.pow(Math.sin(i / 30 * Math.PI), 1.6) * (h - 12) * (0.6 + 0.4 * Math.sin(i * 0.9))); ctx.stroke(); break;
      case 'dots': for (let i = 0; i < 6; i++) for (let r = 0; r < 4; r++) if (r / 4 < hs[i]) { ctx.beginPath(); ctx.arc(6 + i * ((w - 12) / 5), h - 6 - r * ((h - 12) / 3), 2.2, 0, TAU); ctx.fill(); } break;
      case 'particles': [[8, 9, 2], [20, 6, 1.5], [30, 14, 2.5], [14, 22, 1.8], [26, 26, 1.4], [34, 30, 2], [6, 30, 1.2]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x * w / 40, y * h / 36, r, 0, TAU); ctx.fill(); }); break;
      case 'orbs': ctx.globalAlpha = 0.55; [[13, 14, 9], [26, 20, 11], [18, 28, 7]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x * w / 40, y * h / 36, r, 0, TAU); ctx.fill(); }); ctx.globalAlpha = 1; break;
      case 'ring': ctx.beginPath(); ctx.arc(cx, cy, 6, 0, TAU); ctx.fill(); for (let i = 0; i < 18; i++) { const a = i / 18 * TAU; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 10, cy + Math.sin(a) * 10); ctx.lineTo(cx + Math.cos(a) * (12 + hs[i % 7] * 5), cy + Math.sin(a) * (12 + hs[i % 7] * 5)); ctx.stroke(); } break;
      case 'oscilloscope':
        ctx.beginPath();
        for (let i = 0; i <= 36; i++) {
          const x = 3 + (i / 36) * (w - 6), y = cy + Math.sin(i * 0.45) * 8;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        for (let i = 0; i <= 36; i++) {
          const x = 3 + (i / 36) * (w - 6), y = cy + Math.sin(i * 0.45 + 1.2) * 6;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
        break;
      case 'ribbon':
        for (let k = 0; k < 3; k++) {
          ctx.globalAlpha = 0.4 + k * 0.3;
          ctx.beginPath();
          for (let i = 0; i <= 30; i++) {
            const x = 3 + (i / 30) * (w - 6), y = h - 6 - k * 5 - Math.sin(i * 0.3 + k) * 7;
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          }
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        break;
      case 'aurora':
        for (let k = 0; k < 3; k++) {
          ctx.globalAlpha = 0.3 + k * 0.25;
          ctx.beginPath();
          ctx.moveTo(3, h - 3);
          for (let i = 0; i <= 24; i++) {
            const x = 3 + (i / 24) * (w - 6), y = 6 + k * 6 + Math.sin(i * 0.4 + k * 1.5) * 5;
            ctx.lineTo(x, y);
          }
          ctx.lineTo(w - 3, h - 3);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        break;
      case 'mountain':
        for (let k = 2; k >= 0; k--) {
          ctx.globalAlpha = 0.35 + (2 - k) * 0.3;
          ctx.beginPath();
          ctx.moveTo(2, h - 4);
          ctx.lineTo(w * 0.25, 8 + k * 7);
          ctx.lineTo(w * 0.5, 14 + k * 6);
          ctx.lineTo(w * 0.75, 6 + k * 8);
          ctx.lineTo(w - 2, h - 4);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        break;
      case 'vortex':
        for (let r = 1; r <= 4; r++) {
          const rad = r * (w * 0.11);
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * TAU + r * 0.25;
            const px = cx + Math.cos(a) * rad, py = cy + Math.sin(a) * rad;
            i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
          }
          ctx.closePath();
          ctx.stroke();
        }
        break;
      case 'stars':
        [[cx, cy, 2.5], [cx - 10, cy - 8, 1.2], [cx + 12, cy - 9, 1.5], [cx - 12, cy + 10, 1.4], [cx + 10, cy + 8, 1.3], [cx - 6, cy + 4, 1], [cx + 6, cy - 5, 1]].forEach(([x, y, r]) => {
          ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
          ctx.beginPath(); ctx.moveTo(x - (x - cx) * 0.4, y - (y - cy) * 0.4); ctx.lineTo(x, y); ctx.stroke();
        });
        break;
      case 'plasma':
        ctx.beginPath(); ctx.ellipse(cx, cy, 14, 6, Math.PI / 4, 0, TAU); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(cx, cy, 14, 6, -Math.PI / 4, 0, TAU); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx + 8, cy - 8, 2.2, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(cx - 8, cy + 8, 2.2, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(cx, cy, 2, 0, TAU); ctx.fill();
        break;
      case 'pulse':
        [5, 10, 15].forEach((r, idx) => {
          ctx.globalAlpha = 0.4 + idx * 0.3;
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
        });
        ctx.globalAlpha = 1;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU;
          ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 13, cy + Math.sin(a) * 13);
          ctx.lineTo(cx + Math.cos(a) * 16, cy + Math.sin(a) * 16); ctx.stroke();
        }
        break;
      case 'glitch':
        bars(false);
        ctx.save();
        ctx.fillStyle = col;
        ctx.fillRect(4, cy - 3, w * 0.6, 3);
        ctx.fillRect(w * 0.4, cy + 3, w * 0.5, 3);
        ctx.restore();
        break;
      case 'matrix':
        for (let colIdx = 0; colIdx < 6; colIdx++) {
          for (let rowIdx = 0; rowIdx < 5; rowIdx++) {
            ctx.globalAlpha = rowIdx / 5 < hs[colIdx] ? 0.9 : 0.15;
            ctx.beginPath();
            ctx.arc(6 + colIdx * ((w - 12) / 5), h - 6 - rowIdx * ((h - 12) / 4), 1.8, 0, TAU);
            ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
        break;
      case 'specribbon':
        ctx.beginPath();
        ctx.moveTo(3, h - 3);
        for (let i = 0; i <= 20; i++) {
          ctx.lineTo(3 + (i / 20) * (w - 6), h - 5 - hs[i % 7] * (h - 10));
        }
        ctx.lineTo(w - 3, h - 3);
        ctx.closePath();
        ctx.globalAlpha = 0.4;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.stroke();
        break;
      case 'orbitparticles':
        [6, 11, 16].forEach((rad, rIdx) => {
          ctx.globalAlpha = 0.3;
          ctx.beginPath(); ctx.arc(cx, cy, rad, 0, TAU); ctx.stroke();
          ctx.globalAlpha = 0.9;
          for (let p = 0; p < 3; p++) {
            const a = (p / 3) * TAU + rIdx * 0.8;
            ctx.beginPath(); ctx.arc(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad, 1.8, 0, TAU); ctx.fill();
          }
        });
        ctx.globalAlpha = 1;
        break;
      default: break;
    }
  };
})(typeof self !== 'undefined' ? self : this);
