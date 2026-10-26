/* SonicOverlay - validation: extension messages, settings sanitising, preset import. */
(function (root) {
  'use strict';
  const SO = (root.SO = root.SO || {});
  const V = (SO.Validation = {});
  const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
  const HEX = /^#[0-9a-f]{6}$/i;

  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const isInt = (v) => Number.isInteger(v) && v >= 0;
  const num = (v) => typeof v === 'number' && Number.isFinite(v);
  V.isObj = isObj; V.HEX = HEX;

  V.isAllowedImageUrl = function (u) {
    try { const p = new URL(u); return p.protocol === 'https:' && p.hostname === 'i.scdn.co' && u.length < 400; } catch (e) { return false; }
  };

  V.validateMessage = function (msg, sender) {
    const M = SO.MSG;
    if (!isObj(msg) || typeof msg.type !== 'string') return false;
    if (sender && sender.id && root.chrome && chrome.runtime && sender.id !== chrome.runtime.id) return false;
    switch (msg.type) {
      case M.CAPTURE_START: return isInt(msg.tabId) && typeof msg.streamId === 'string' && msg.streamId.length > 0 && msg.streamId.length < 600;
      case M.CAPTURE_STOP:
      case M.CAPTURE_GET_STATUS:
      case M.OFFSCREEN_STOP:
      case M.OVERLAY_GET_STATE: return true;
      case M.CAPTURE_STATUS: return Object.values(SO.STATUS).includes(msg.status);
      case M.OFFSCREEN_START: return msg.target === 'offscreen' && isInt(msg.tabId) && typeof msg.streamId === 'string' && SO.FFT_SIZES.includes(msg.fftSize);
      case M.OFFSCREEN_CONFIG: return SO.FFT_SIZES.includes(msg.fftSize) && (msg.target === undefined || msg.target === 'offscreen');
      case M.OFFSCREEN_EVENT: return ['ended', 'error', 'suspended'].includes(msg.event);
      case M.FRAME: return typeof msg.f === 'string' && typeof msg.t === 'string' && msg.f.length < 20000 && msg.t.length < 20000 && num(msg.sr) && SO.FFT_SIZES.includes(msg.fft);
      case M.OVERLAY_COMMAND: return SO.COMMANDS.includes(msg.command);
      case M.FETCH_IMAGE: return typeof msg.url === 'string' && V.isAllowedImageUrl(msg.url);
      default: return false;
    }
  };

  function sanitizeLeaf(def, val, path, opts) {
    const range = opts.ranges && opts.ranges[path];
    const en = opts.enums && opts.enums[path];
    if (typeof def === 'boolean') return typeof val === 'boolean' ? val : def;
    if (typeof def === 'number') {
      if (!num(val)) return def;
      if (en) return en.includes(val) ? val : def;
      if (range) return Math.min(range[1], Math.max(range[0], val));
      return Math.min(100000, Math.max(-100000, val));
    }
    if (typeof def === 'string') {
      if (typeof val !== 'string') return def;
      if (HEX.test(def)) return HEX.test(val) ? val.toLowerCase() : def;
      if (en) return en.includes(val) ? val : def;
      return val.length <= 64 ? val : def;
    }
    return def;
  }

  function sanitizeArray(val, def, path) {
    if (path === 'color.stops') {
      if (!Array.isArray(val)) return def.map((x) => Object.assign({}, x));
      return val.slice(0, 3).filter((s) => isObj(s) && num(s.pos) && typeof s.color === 'string' && HEX.test(s.color))
        .map((s) => ({ pos: Math.min(0.95, Math.max(0.05, s.pos)), color: s.color.toLowerCase() }))
        .sort((a, b) => a.pos - b.pos);
    }
    return def.slice();
  }

  V.sanitizeObject = function sanitizeObject(input, defaults, opts, path) {
    const out = {};
    const src = isObj(input) ? input : {};
    for (const key of Object.keys(defaults)) {
      if (BAD_KEYS.has(key)) continue;
      const def = defaults[key];
      const p = path ? path + '.' + key : key;
      const val = Object.prototype.hasOwnProperty.call(src, key) ? src[key] : undefined;
      if (isObj(def)) out[key] = sanitizeObject(val, def, opts, p);
      else if (Array.isArray(def)) out[key] = sanitizeArray(val, def, p);
      else out[key] = sanitizeLeaf(def, val, p, opts);
    }
    return out;
  };

  V.primitivesOnly = function (obj) {
    const out = {};
    if (!isObj(obj)) return out;
    for (const k of Object.keys(obj)) {
      if (BAD_KEYS.has(k)) continue;
      const v = obj[k];
      if (typeof v === 'boolean' || (typeof v === 'string' && v.length <= 64) || num(v)) out[k] = v;
    }
    return out;
  };

  V.safeParse = function (text, maxBytes) {
    if (typeof text !== 'string' || text.length === 0) throw new Error('File is empty.');
    if (text.length > (maxBytes || 524288)) throw new Error('File is too large (limit 512 KB).');
    return JSON.parse(text, function (k, v) {
      if (BAD_KEYS.has(k)) throw new Error('File contains forbidden key "' + k + '".');
      return v;
    });
  };

  V.validPresetName = function (n) {
    return typeof n === 'string' && n.trim().length >= 1 && n.trim().length <= 40 && !/[\u0000-\u001f<>]/.test(n);
  };
})(typeof self !== 'undefined' ? self : this);
