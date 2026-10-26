/* SonicOverlay - small DOM helpers. Text is always set through textContent. */
(function (root) {
  'use strict';
  const SO = (root.SO = root.SO || {});
  const U = (SO.Util = {});
  const SVGNS = 'http://www.w3.org/2000/svg';

  U.clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  U.lerp = (a, b, t) => a + (b - a) * t;

  U.el = function (tag, attrs, ...kids) {
    const n = document.createElement(tag);
    if (attrs) for (const k of Object.keys(attrs)) {
      const v = attrs[k];
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
      else n.setAttribute(k, v === true ? '' : String(v));
    }
    for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) n.append(c.nodeType ? c : document.createTextNode(String(c)));
    return n;
  };

  U.svg = function (tag, attrs, ...kids) {
    const n = document.createElementNS(SVGNS, tag);
    if (attrs) for (const k of Object.keys(attrs)) n.setAttribute(k, String(attrs[k]));
    for (const c of kids) if (c) n.append(c);
    return n;
  };

  U.logoSvg = function (size) {
    const bars = [[3, 6, 9], [8, 3, 18], [13, 5, 12], [18, 1, 20]];
    return U.svg('svg', { viewBox: '0 0 24 24', width: size || 18, height: size || 18, 'aria-hidden': 'true' },
      ...bars.map(([x, y, h]) => U.svg('rect', { x, y: 23 - h, width: 3, height: h, rx: 1.5, fill: 'currentColor' })));
  };

  U.debounce = function (fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  U.getPath = function (obj, path) { let o = obj; for (const k of path.split('.')) { if (o == null) return undefined; o = o[k]; } return o; };
  U.setPath = function (obj, path, val) {
    const keys = path.split('.');
    let o = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') return;
      if (o[k] === null || typeof o[k] !== 'object') o[k] = {};
      o = o[k];
    }
    const last = keys[keys.length - 1];
    if (last === '__proto__' || last === 'constructor' || last === 'prototype') return;
    o[last] = val;
  };
  U.clone = (o) => JSON.parse(JSON.stringify(o));
  U.extensionAlive = () => { try { return !!(root.chrome && chrome.runtime && chrome.runtime.id); } catch (e) { return false; } };

  /** sendMessage that never throws; resolves {ok:false,error} on failure. */
  U.send = function (msg) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(msg, (res) => {
          const err = chrome.runtime.lastError;
          if (err) resolve({ ok: false, error: SO.makeError(/invalidated/i.test(err.message) ? 'CONTEXT_INVALIDATED' : 'OFFSCREEN_UNAVAILABLE', err.message) });
          else resolve(res || { ok: true });
        });
      } catch (e) { resolve({ ok: false, error: SO.makeError('CONTEXT_INVALIDATED', e.message) }); }
    });
  };

  U.fmtTime = function (s) {
    if (!Number.isFinite(s) || s < 0) return '0:00';
    s = Math.floor(s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(r).padStart(2, '0');
  };
})(typeof self !== 'undefined' ? self : this);
