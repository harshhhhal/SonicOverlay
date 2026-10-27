/* SonicOverlay - settings schema, persistence (chrome.storage.local) and the shared controller. */
(function (root) {
  'use strict';
  const SO = (root.SO = root.SO || {});
  const V = SO.Validation, U = SO.Util;
  const KEY = 'so.settings', SESSION_KEY = 'so.previousSession';

  SO.VIZ_LIST = [
    ['classic-spectrum', 'Classic Spectrum', 'bottom'], ['radial-spectrum', 'Radial Spectrum', 'center'], ['circular-waveform', 'Circular Waveform', 'center'],
    ['linear-waveform', 'Linear Waveform', 'bottom-slim'], ['mirrored-spectrum', 'Mirrored Spectrum', 'bottom'], ['frequency-curve', 'Frequency Curve', 'bottom'],
    ['dot-spectrum', 'Dot Spectrum', 'bottom'], ['stacked-spectrum', 'Stacked Spectrum', 'bottom'], ['particle-field', 'Particle Field', 'full'],
    ['ambient-orbs', 'Ambient Orbs', 'full'], ['album-art-ring', 'Album Art Ring', 'ring'], ['minimal-equalizer', 'Minimal Equalizer', 'corner'],
    ['neon-oscilloscope', 'Neon Oscilloscope', 'bottom-slim'], ['liquid-ribbon', 'Liquid Ribbon', 'bottom'], ['aurora-flow', 'Aurora Flow', 'full'],
    ['frequency-mountain', 'Frequency Mountain', 'bottom'], ['vortex-tunnel', 'Vortex Tunnel', 'center'], ['starfield-drift', 'Starfield Drift', 'full'],
    ['plasma-orbit', 'Plasma Orbit', 'center'], ['concentric-pulse', 'Concentric Pulse', 'center'], ['glitch-spectrum', 'Glitch Spectrum', 'bottom'],
    ['equalizer-matrix', 'Equalizer Matrix', 'bottom'], ['spectrum-ribbon', 'Spectrum Ribbon', 'bottom'], ['orbiting-particles', 'Orbiting Particles', 'center']
  ].map(([id, name, layout]) => ({ id, name, layout }));
  const VIZ_IDS = SO.VIZ_LIST.map((v) => v.id);

  SO.LAYOUTS = {
    full: { label: 'Full screen', x: 50, y: 50, width: 100, height: 100 },
    bottom: { label: 'Bottom band', x: 50, y: 78, width: 100, height: 44 },
    'bottom-slim': { label: 'Bottom slim', x: 50, y: 90, width: 96, height: 20 },
    top: { label: 'Top band', x: 50, y: 14, width: 100, height: 30 },
    center: { label: 'Center', x: 50, y: 50, width: 60, height: 60 },
    ring: { label: 'Center square', x: 50, y: 50, width: 46, height: 80 },
    left: { label: 'Left column', x: 11, y: 50, width: 22, height: 92 },
    right: { label: 'Right column', x: 89, y: 50, width: 22, height: 92 },
    corner: { label: 'Corner widget', x: 13, y: 91, width: 22, height: 12 }
  };

  const DEFAULTS = {
    version: 1,
    enabled: true,
    visualizer: 'classic-spectrum',
    presetName: 'Custom',
    reducedMotion: false,
    ui: { panelVisible: false, compact: false, panelX: -1, panelY: -1, collapsed: { general: false, viz: false, appearance: true, audio: true, effects: true, layout: true, meta: true, presets: true } },
    layout: { x: 50, y: 78, width: 100, height: 44, rotation: 0, scale: 100, snap: true, locked: false },
    color: {
      mode: 'gradient', artInfluence: 100, primary: '#00f0ff', secondary: '#ff2bd6', stops: [], gradientAngle: 90,
      opacity: 100, glowIntensity: 40, glowRadius: 14, shadow: false, bgFill: false, bgColor: '#000000', bgOpacity: 30, blendMode: 'normal'
    },
    audio: { sensitivity: 100, smoothing: 70, bassBoost: 100, midResponse: 100, highResponse: 100, decay: 65, amplitude: 100, fftSize: 2048, peakHold: 50, animationSpeed: 100 },
    effects: { particleDensity: 60, particleSpeed: 100, particleSize: 3, particleLifetime: 4, blur: 0, waveDistortion: 0, beatScale: false, beatAmount: 12, colorShift: false, subtleMotion: false },
    meta: { showArt: true, artSize: 240, showTitle: false, showArtist: false, showProgress: false, fontFamily: 'system', fontSize: 20, fontWeight: 600, textAlign: 'center', textColor: '#ffffff', textShadow: true, textPlacement: 'below' },
    viz: {}
  };

  const RANGES = {
    visualizer: null, 'layout.x': [-20, 120], 'layout.y': [-20, 120], 'layout.width': [2, 200], 'layout.height': [2, 200], 'layout.rotation': [-180, 180], 'layout.scale': [10, 300],
    'ui.panelX': [-1, 10000], 'ui.panelY': [-1, 10000],
    'color.artInfluence': [0, 100], 'color.gradientAngle': [0, 360], 'color.opacity': [0, 100], 'color.glowIntensity': [0, 100], 'color.glowRadius': [0, 60], 'color.bgOpacity': [0, 100],
    'audio.sensitivity': [0, 200], 'audio.smoothing': [0, 95], 'audio.bassBoost': [0, 200], 'audio.midResponse': [0, 200], 'audio.highResponse': [0, 200], 'audio.decay': [0, 100],
    'audio.amplitude': [0, 300], 'audio.peakHold': [0, 100], 'audio.animationSpeed': [10, 300],
    'effects.particleDensity': [0, 100], 'effects.particleSpeed': [10, 300], 'effects.particleSize': [1, 16], 'effects.particleLifetime': [0.5, 12], 'effects.blur': [0, 20],
    'effects.waveDistortion': [0, 100], 'effects.beatAmount': [0, 40],
    'meta.artSize': [60, 600], 'meta.fontSize': [10, 64], 'meta.fontWeight': [300, 900]
  };
  const ENUMS = {
    visualizer: VIZ_IDS, 'color.mode': ['gradient', 'solid', 'rainbow', 'mono'],
    'color.blendMode': ['normal', 'screen', 'lighten', 'overlay', 'color-dodge', 'plus-lighter', 'difference'],
    'audio.fftSize': SO.FFT_SIZES.slice(), 'meta.fontFamily': ['system', 'serif', 'mono', 'rounded', 'condensed'],
    'meta.textAlign': ['left', 'center', 'right'], 'meta.textPlacement': ['below', 'above', 'center']
  };
  const PRESET_KEYS = ['visualizer', 'audio', 'layout', 'color', 'effects', 'meta', 'viz'];

  function sanitize(input) {
    const base = Object.assign({}, DEFAULTS); delete base.viz;
    const out = V.sanitizeObject(input, base, { ranges: RANGES, enums: ENUMS }, '');
    out.viz = {};
    const rawViz = V.isObj(input) && V.isObj(input.viz) ? input.viz : {};
    for (const id of VIZ_IDS) {
      const raw = Object.prototype.hasOwnProperty.call(rawViz, id) ? rawViz[id] : undefined;
      if (raw === undefined) continue;
      const reg = SO.Registry && SO.Registry.get(id);
      out.viz[id] = reg ? V.sanitizeObject(raw, reg.defaults, { ranges: reg.ranges, enums: reg.enums }, '') : V.primitivesOnly(raw);
    }
    return out;
  }

  const hasStorage = () => !!(root.chrome && chrome.storage && chrome.storage.local);

  const Store = (SO.SettingsStore = {
    DEFAULTS, RANGES, ENUMS, PRESET_KEYS, KEY, sanitize,
    defaults() { return U.clone(DEFAULTS); },
    async load() {
      if (!hasStorage()) return sanitize(null);
      try { const r = await chrome.storage.local.get(KEY); return sanitize(r[KEY]); } catch (e) { return sanitize(null); }
    },
    async save(settings) {
      if (!hasStorage()) return false;
      try { await chrome.storage.local.set({ [KEY]: settings }); return true; } catch (e) { return false; }
    },
    async update(fn) { const s = await Store.load(); fn(s); const c = sanitize(s); await Store.save(c); return c; },
    async snapshotSession(settings) { if (hasStorage()) try { await chrome.storage.local.set({ [SESSION_KEY]: settings }); } catch (e) { /* ignore */ } },
    async loadSession() { if (!hasStorage()) return null; try { const r = await chrome.storage.local.get(SESSION_KEY); return r[SESSION_KEY] ? sanitize(r[SESSION_KEY]) : null; } catch (e) { return null; } },

    /** Mutable controller shared by the in-page panel and options page. */
    createController(initial, opts) {
      opts = opts || {};
      let s = sanitize(initial);
      let last = JSON.stringify(s);
      const subs = new Set();
      let timer = null;
      const save = () => {
        clearTimeout(timer);
        timer = setTimeout(() => { last = JSON.stringify(s); Store.save(s); }, 250);
      };
      const notify = (kind, path) => subs.forEach((fn) => { try { fn(s, kind, path); } catch (e) { console.error('[SonicOverlay]', e); } });
      const ctrl = {
        get settings() { return s; },
        subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
        get(path) { return U.getPath(s, path); },
        set(path, val) { U.setPath(s, path, val); notify('set', path); save(); },
        /** Run a mutator then notify as a structural change. */
        mutate(fn, kind) { fn(s); s = sanitize(s); notify(kind || 'replace'); save(); },
        replace(next, kind) { s = sanitize(next); notify(kind || 'replace'); save(); },
        flush() { clearTimeout(timer); last = JSON.stringify(s); return Store.save(s); },
        listenExternal() {
          if (!hasStorage() || !chrome.storage.onChanged) return;
          chrome.storage.onChanged.addListener((ch, area) => {
            if (area !== 'local' || !ch[KEY] || !ch[KEY].newValue) return;
            const incoming = sanitize(ch[KEY].newValue);
            if (JSON.stringify(incoming) === last || JSON.stringify(incoming) === JSON.stringify(s)) return;
            last = JSON.stringify(incoming); s = incoming; notify('external');
          });
        }
      };
      return ctrl;
    }
  });
})(typeof self !== 'undefined' ? self : this);
