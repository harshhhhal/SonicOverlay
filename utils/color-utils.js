/* SonicOverlay - colour maths, album-art palette extraction and gradient colour sources. */
(function (root) {
  'use strict';
  const SO = (root.SO = root.SO || {});
  const C = (SO.Color = {});
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  C.hexToRgb = function (h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  C.rgbToHex = function (c) { return '#' + c.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join(''); };
  C.rgbToHsl = function (r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    let h = 0, s = 0;
    if (d) {
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)); else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
      h *= 60;
    }
    return [h, s, l];
  };
  C.hslToRgb = function (h, s, l) {
    h = ((h % 360) + 360) % 360 / 360;
    if (!s) { const v = l * 255; return [v, v, v]; }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
  };
  C.lerpRgb = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  C.rgba = (c, a) => 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + (a === undefined ? 1 : Math.round(clamp(a, 0, 1) * 1000) / 1000) + ')';

  /** Make a colour punchy but legible on both dark and light Spotify surfaces. */
  C.vivid = function (rgb) {
    const [h, s, l] = C.rgbToHsl(rgb[0], rgb[1], rgb[2]);
    return C.hslToRgb(h, clamp(s * 1.15, 0.5, 1), clamp(l, 0.5, 0.68));
  };

  /**
   * Extract exactly three dominant, visible colours from RGBA pixel data (album artwork).
   * Hue-bucketed, saturation-weighted; near-black/near-white and grey pixels are down-weighted.
   * Returns [[r,g,b],[r,g,b],[r,g,b]].
   */
  C.extractPalette = function (data) {
    const B = 36, w = new Float32Array(B), sr = new Float32Array(B), sg = new Float32Array(B), sb = new Float32Array(B);
    let maxS = 0, lumSum = 0, cnt = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const [h, s, l] = C.rgbToHsl(r, g, b);
      lumSum += l; cnt++;
      if (l < 0.1 || l > 0.94) continue;
      if (s > maxS) maxS = s;
      const wt = s * s * (1 - Math.abs(2 * l - 1) * 0.6) + 0.002;
      const k = Math.floor(h / 10) % B;
      w[k] += wt; sr[k] += r * wt; sg[k] += g * wt; sb[k] += b * wt;
    }
    if (!cnt) return [[200, 200, 200], [160, 160, 160], [230, 230, 230]];
    const score = (k) => w[k] + 0.5 * (w[(k + B - 1) % B] + w[(k + 1) % B]);
    const colorOf = (k) => { const t = w[k] || 1e-6; return [sr[k] / t, sg[k] / t, sb[k] / t]; };
    if (maxS < 0.14) {  // greyscale artwork
      const l = clamp(lumSum / cnt, 0.45, 0.8) * 255;
      return [[l, l, l], [l * 0.72, l * 0.72, l * 0.74], [Math.min(255, l * 1.15), Math.min(255, l * 1.15), Math.min(255, l * 1.15)]];
    }
    const picks = [];
    const dist = (a, b) => { const d = Math.abs(a - b); return Math.min(d, B - d); };
    let best = 0;
    for (let k = 1; k < B; k++) if (score(k) > score(best)) best = k;
    picks.push(best);
    const top = score(best);
    for (let n = 0; n < 2; n++) {
      let cand = -1;
      for (let k = 0; k < B; k++) {
        if (picks.some((p) => dist(p, k) < 4)) continue;
        if (score(k) >= top * 0.08 && (cand < 0 || score(k) > score(cand))) cand = k;
      }
      if (cand >= 0) picks.push(cand);
    }
    const out = picks.map((k) => C.vivid(colorOf(k)));
    const base = C.rgbToHsl(out[0][0], out[0][1], out[0][2]);
    while (out.length < 3) out.push(C.hslToRgb(base[0] + (out.length === 1 ? 35 : -35), base[1], clamp(base[2] + (out.length === 1 ? 0.04 : 0.1), 0.45, 0.78)));
    return out;
  };

  /**
   * Build a colour source for one frame.
   * cfg = settings.color, art = {rgb:[3 colours], weight:0..1} | null, time (s), shift (deg)
   */
  C.makeColorSource = function (cfg, art, time, shift) {
    let stops;
    const P = C.hexToRgb(cfg.primary), S = C.hexToRgb(cfg.secondary);
    if (cfg.mode === 'rainbow') {
      stops = []; for (let i = 0; i <= 6; i++) stops.push({ pos: i / 6, rgb: C.hslToRgb(i * 60 + time * 30, 0.9, 0.6) });
    } else if (cfg.mode === 'mono') {
      const l = C.rgbToHsl(P[0], P[1], P[2])[2];
      stops = [{ pos: 0, rgb: C.hslToRgb(0, 0, clamp(l + 0.18, 0.5, 0.98)) }, { pos: 1, rgb: C.hslToRgb(0, 0, clamp(l - 0.12, 0.3, 0.85)) }];
    } else {
      if (cfg.mode === 'solid') stops = [{ pos: 0, rgb: P }, { pos: 1, rgb: P }];
      else {
        stops = [{ pos: 0, rgb: P }];
        for (const s of cfg.stops || []) stops.push({ pos: s.pos, rgb: C.hexToRgb(s.color) });
        stops.push({ pos: 1, rgb: S });
      }
      const infl = art ? clamp((cfg.artInfluence / 100) * art.weight, 0, 1) : 0;
      if (infl > 0.001) {
        const at = (st, t) => atStops(st, t);
        const ar = [{ pos: 0, rgb: art.rgb[0] }, { pos: 0.5, rgb: art.rgb[1] }, { pos: 1, rgb: art.rgb[2] }];
        const mixed = [];
        for (let i = 0; i < 5; i++) { const t = i / 4; mixed.push({ pos: t, rgb: C.lerpRgb(at(stops, t), at(ar, t), infl) }); }
        stops = cfg.mode === 'solid' ? [{ pos: 0, rgb: mixed[0].rgb }, { pos: 1, rgb: mixed[0].rgb }] : mixed;
      }
    }
    if (shift) stops = stops.map((s) => { const h = C.rgbToHsl(s.rgb[0], s.rgb[1], s.rgb[2]); return { pos: s.pos, rgb: C.hslToRgb(h[0] + shift, h[1], h[2]) }; });
    return makeSource(stops);
  };

  function atStops(stops, t) {
    t = clamp(t, 0, 1);
    if (t <= stops[0].pos) return stops[0].rgb;
    for (let i = 1; i < stops.length; i++) {
      if (t <= stops[i].pos) { const a = stops[i - 1], b = stops[i]; return C.lerpRgb(a.rgb, b.rgb, (t - a.pos) / Math.max(1e-6, b.pos - a.pos)); }
    }
    return stops[stops.length - 1].rgb;
  }

  function makeSource(stops) {
    return {
      stops,
      at: (t) => atStops(stops, t),
      css: (t, a) => C.rgba(atStops(stops, t), a),
      lut(n, a) { const o = new Array(n); for (let i = 0; i < n; i++) o[i] = C.rgba(atStops(stops, n > 1 ? i / (n - 1) : 0), a); return o; },
      /** CSS-style angle: 0 = bottom->top, 90 = left->right. */
      gradient(ctx, w, h, angle, a) {
        const r = (angle || 0) * Math.PI / 180, dx = Math.sin(r), dy = -Math.cos(r);
        const L = Math.abs(w * dx) + Math.abs(h * dy) || 1;
        const cx = w / 2, cy = h / 2;
        const g = ctx.createLinearGradient(cx - dx * L / 2, cy - dy * L / 2, cx + dx * L / 2, cy + dy * L / 2);
        const sorted = stops.slice().sort((p, q) => p.pos - q.pos);
        for (const s of sorted) g.addColorStop(clamp(s.pos, 0, 1), C.rgba(s.rgb, a));
        return g;
      }
    };
  }
  C.simpleSource = function (hexA, hexB) { return makeSource([{ pos: 0, rgb: C.hexToRgb(hexA) }, { pos: 1, rgb: C.hexToRgb(hexB) }]); };
})(typeof self !== 'undefined' ? self : this);
