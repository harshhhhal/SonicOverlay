/* SonicOverlay - named presets: built-ins, user presets, import/export with validation. */
(function (root) {
  'use strict';
  const SO = (root.SO = root.SO || {});
  const V = SO.Validation, U = SO.Util, SS = SO.SettingsStore;
  const KEY = 'so.presets';
  const FORMAT = 'sonic-overlay-presets';

  function build(visualizer, layoutKey, delta) {
    const s = SS.defaults();
    s.visualizer = visualizer;
    Object.assign(s.layout, SO.LAYOUTS[layoutKey]);
    delete s.layout.label;
    for (const k of Object.keys(delta || {})) {
      if (k === 'viz') s.viz = delta.viz;
      else if (V.isObj(delta[k])) Object.assign(s[k], delta[k]);
    }
    return SS.sanitize(s);
  }
  const snap = (s) => { const o = {}; for (const k of SS.PRESET_KEYS) o[k] = U.clone(s[k]); return o; };

  const BUILT_IN = {
    'Cyberpunk Neon': () => build('mirrored-spectrum', 'bottom', {
      color: { primary: '#00f0ff', secondary: '#ff2bd6', stops: [{ pos: 0.5, color: '#7a5cff' }], artInfluence: 35, glowIntensity: 85, glowRadius: 24, gradientAngle: 90 },
      viz: { 'mirrored-spectrum': { layout: 'center-out', barCount: 72, barSpacing: 3 } } }),
    'AMOLED Minimal': () => build('minimal-equalizer', 'corner', {
      color: { mode: 'gradient', primary: '#ffffff', secondary: '#9aa0a6', artInfluence: 100, glowIntensity: 0, opacity: 90 },
      viz: { 'minimal-equalizer': { barCount: 28, barWidth: 3, barSpacing: 3 } } }),
    'Vaporwave': () => build('dot-spectrum', 'bottom', {
      color: { primary: '#ff71ce', secondary: '#01cdfe', stops: [{ pos: 0.5, color: '#b967ff' }], artInfluence: 35, glowIntensity: 60, glowRadius: 16, gradientAngle: 0 },
      viz: { 'dot-spectrum': { columns: 40, dotCount: 12, dotSize: 72 } } }),
    'Retro Equalizer': () => build('stacked-spectrum', 'bottom', {
      color: { primary: '#39ff14', secondary: '#ff2a2a', stops: [{ pos: 0.6, color: '#ffe600' }], artInfluence: 25, glowIntensity: 20, glowRadius: 8, gradientAngle: 0 },
      viz: { 'stacked-spectrum': { barCount: 24, segCount: 14, segGap: 3, barSpacing: 6, colorBands: true, cornerRadius: 0 } } }),
    'Cinematic Ring': () => build('album-art-ring', 'ring', {
      color: { artInfluence: 100, glowIntensity: 55, glowRadius: 20 },
      meta: { showTitle: true, showArtist: true, artSize: 260, fontSize: 22 },
      viz: { 'album-art-ring': { barCount: 108, spin: true } } }),
    'Purple Haze': () => build('ambient-orbs', 'full', {
      color: { primary: '#8b5cf6', secondary: '#ec4899', stops: [{ pos: 0.5, color: '#4f46e5' }], artInfluence: 40, opacity: 85 },
      viz: { 'ambient-orbs': { orbCount: 8, softness: 70, baseSize: 26 } } }),
    'Electric Blue': () => build('radial-spectrum', 'center', {
      color: { primary: '#00b4ff', secondary: '#3a5bff', artInfluence: 35, glowIntensity: 70, glowRadius: 20 },
      viz: { 'radial-spectrum': { barCount: 120, direction: 'outward', rotationSpeed: 8 } } }),
    'Monochrome': () => build('frequency-curve', 'bottom', {
      color: { mode: 'mono', primary: '#ffffff', glowIntensity: 15 },
      viz: { 'frequency-curve': { lines: 3, filled: true, fillOpacity: 14 } } }),
    'Ambient Particles': () => build('particle-field', 'full', {
      color: { artInfluence: 100, glowIntensity: 40 },
      effects: { particleDensity: 70, particleSize: 3, particleLifetime: 5, beatScale: false },
      viz: { 'particle-field': { connections: true, turbulence: 45, bassPush: 70 } } }),
    'Minimal Waveform': () => build('linear-waveform', 'bottom-slim', {
      color: { artInfluence: 100, glowIntensity: 25 },
      viz: { 'linear-waveform': { lineThickness: 2, mode: 'single', smoothing: 70 } } }),
    'Rainbow Spectrum': () => build('classic-spectrum', 'bottom', {
      color: { mode: 'rainbow', glowIntensity: 45 },
      viz: { 'classic-spectrum': { barCount: 72, mirrored: false, peaks: true } } }),
    'Neon Cyberwave': () => build('neon-oscilloscope', 'bottom-slim', {
      color: { primary: '#00f0ff', secondary: '#ff2bd6', artInfluence: 30, glowIntensity: 80, glowRadius: 20 },
      viz: { 'neon-oscilloscope': { amplitude: 140, lineThickness: 3, traces: 'dual', persistence: 60 } } }),
    'Aurora Borealis': () => build('aurora-flow', 'full', {
      color: { primary: '#00ffaa', secondary: '#7928ca', stops: [{ pos: 0.5, color: '#0070f3' }], artInfluence: 25, glowIntensity: 70 },
      viz: { 'aurora-flow': { curtains: 4, height: 85, flowSpeed: 75, shimmer: 60 } } }),
    'Cosmic Vortex': () => build('vortex-tunnel', 'center', {
      color: { primary: '#ff007f', secondary: '#7928ca', artInfluence: 40, glowIntensity: 75, glowRadius: 18 },
      viz: { 'vortex-tunnel': { ringCount: 14, sides: '6', twist: 50, bassExpand: 90, spokes: true } } }),
    'Hardware Matrix': () => build('equalizer-matrix', 'bottom', {
      color: { primary: '#00f0ff', secondary: '#39ff14', stops: [{ pos: 0.6, color: '#ffe600' }], artInfluence: 35, glowIntensity: 50, glowRadius: 10 },
      viz: { 'equalizer-matrix': { columns: 36, rows: 14, cellShape: 'rounded', cellGap: 2, peaks: true } } }),
    'Custom': () => build('classic-spectrum', 'bottom', {})
  };
  const BUILT_IN_NAMES = Object.keys(BUILT_IN);

  const has = () => !!(root.chrome && chrome.storage && chrome.storage.local);
  async function loadAll() {
    let data = null;
    if (has()) try { data = (await chrome.storage.local.get(KEY))[KEY]; } catch (e) { /* ignore */ }
    if (!V.isObj(data) || !V.isObj(data.items) || !Array.isArray(data.order)) {
      data = { items: {}, order: [] };
      for (const n of BUILT_IN_NAMES) { data.items[n] = snap(BUILT_IN[n]()); data.order.push(n); }
      await saveAll(data);
    }
    return data;
  }
  async function saveAll(d) { if (has()) try { await chrome.storage.local.set({ [KEY]: d }); } catch (e) { /* ignore */ } }
  function uniqueName(order, base) {
    base = base.trim().slice(0, 40); if (!order.includes(base)) return base;
    for (let i = 2; i < 999; i++) { const n = (base.slice(0, 36) + ' (' + i + ')'); if (!order.includes(n)) return n; }
    return base;
  }

  const P = (SO.PresetStore = {
    BUILT_IN_NAMES, FORMAT, snapshot: snap,
    isBuiltIn: (n) => BUILT_IN_NAMES.includes(n),
    async list() { return (await loadAll()).order.slice(); },
    async get(name) { const d = await loadAll(); return d.items[name] ? SS.sanitize(d.items[name]) : null; },
    /** Apply a preset snapshot over current settings (keeps runtime/UI flags and layout lock/snap). */
    applyTo(settings, snapshot, name) {
      const next = U.clone(settings);
      const keepLayout = { locked: settings.layout.locked, snap: settings.layout.snap };
      for (const k of SS.PRESET_KEYS) next[k] = U.clone(snapshot[k]);
      Object.assign(next.layout, keepLayout);
      next.presetName = name;
      return SS.sanitize(next);
    },
    async save(name, settings) {
      if (!V.validPresetName(name)) throw new Error('Preset names must be 1-40 characters.');
      const d = await loadAll(); name = name.trim();
      if (!d.items[name]) d.order.push(name);
      d.items[name] = snap(settings); await saveAll(d); return name;
    },
    async rename(oldName, newName) {
      if (!V.validPresetName(newName)) throw new Error('Preset names must be 1-40 characters.');
      const d = await loadAll(); newName = newName.trim();
      if (!d.items[oldName]) throw new Error('Preset not found.');
      if (newName !== oldName && d.items[newName]) throw new Error('A preset with that name already exists.');
      d.items[newName] = d.items[oldName]; if (newName !== oldName) delete d.items[oldName];
      d.order = d.order.map((n) => (n === oldName ? newName : n)); await saveAll(d); return newName;
    },
    async duplicate(name) {
      const d = await loadAll(); if (!d.items[name]) throw new Error('Preset not found.');
      const n = uniqueName(d.order, name + ' copy'); d.items[n] = U.clone(d.items[name]); d.order.push(n); await saveAll(d); return n;
    },
    async remove(name) { const d = await loadAll(); delete d.items[name]; d.order = d.order.filter((n) => n !== name); await saveAll(d); },
    async restoreBuiltIns() {
      const d = await loadAll();
      for (const n of BUILT_IN_NAMES) { d.items[n] = snap(BUILT_IN[n]()); if (!d.order.includes(n)) d.order.push(n); }
      await saveAll(d); return d.order.slice();
    },
    async exportJSON(names) {
      const d = await loadAll(); const list = (names && names.length ? names : d.order).filter((n) => d.items[n]);
      return JSON.stringify({ format: FORMAT, version: 1, presets: list.map((n) => ({ name: n, settings: d.items[n] })) }, null, 2);
    },
    /** Validates and imports; throws Error with a human message on malformed files. */
    async importJSON(text) {
      const data = V.safeParse(text);
      if (!V.isObj(data) || data.format !== FORMAT || data.version !== 1 || !Array.isArray(data.presets)) throw new Error('This is not a SonicOverlay preset file.');
      if (data.presets.length === 0 || data.presets.length > 50) throw new Error('Preset file must contain 1-50 presets.');
      const d = await loadAll(); const added = [];
      for (const p of data.presets) {
        if (!V.isObj(p) || !V.validPresetName(p.name) || !V.isObj(p.settings)) throw new Error('Preset file contains a malformed entry.');
        const name = uniqueName(d.order, p.name);
        d.items[name] = snap(SS.sanitize(p.settings)); d.order.push(name); added.push(name);
      }
      await saveAll(d); return added;
    }
  });
})(typeof self !== 'undefined' ? self : this);
