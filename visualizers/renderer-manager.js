/* SonicOverlay - visualizer registry and the renderer manager (layout transform, effects, metadata text). */
(function (root) {
  'use strict';
  const SO = (root.SO = root.SO || {});

  const map = new Map();
  SO.Registry = {
    register(def) {
      def.ranges = {}; def.enums = {};
      for (const c of def.controls || []) {
        if (c.type === 'range') def.ranges[c.key] = [c.min, c.max];
        else if (c.type === 'select') def.enums[c.key] = c.options.map((o) => o[0]);
      }
      map.set(def.id, def);
    },
    get: (id) => map.get(id),
    list: () => SO.VIZ_LIST.map((v) => map.get(v.id)).filter(Boolean)
  };
  SO.registerVisualizer = (def) => SO.Registry.register(def);
  SO.ctl = {
    range: (key, label, min, max, step) => ({ key, label, type: 'range', min, max, step: step || 1 }),
    toggle: (key, label) => ({ key, label, type: 'toggle' }),
    select: (key, label, options) => ({ key, label, type: 'select', options }),
    color: (key, label) => ({ key, label, type: 'color' })
  };

  SO.RendererManager = class RendererManager {
    constructor(canvas) {
      this.canvas = canvas; this.ctx = canvas.getContext('2d', { alpha: true });
      this.W = 0; this.H = 0; this.dpr = 1; this.time = 0; this.states = new Map(); this.failed = new Set();
      this.c = { H: SO.H }; this.lastFilter = '';
    }
    resize(w, h, dpr) {
      this.W = w; this.H = h; this.dpr = dpr;
      this.canvas.width = Math.max(1, Math.round(w * dpr)); this.canvas.height = Math.max(1, Math.round(h * dpr));
    }
    resetState(id) { this.states.delete(id); this.failed.delete(id); }
    resetAll() { this.states.clear(); this.failed.clear(); }

    /** Layout rectangle in CSS pixels (centre, size, scale, rotation). */
    rect(s) {
      const L = s.layout;
      return { cx: L.x / 100 * this.W, cy: L.y / 100 * this.H, w: L.width / 100 * this.W, h: L.height / 100 * this.H, scale: L.scale / 100, rot: L.rotation * Math.PI / 180 };
    }

    render(app, dt) {
      const ctx = this.ctx, s = app.settings, f = app.frame;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      const blur = s.effects.blur > 0 ? 'blur(' + s.effects.blur + 'px)' : '';
      if (blur !== this.lastFilter) { this.canvas.style.filter = blur; this.lastFilter = blur; }
      if (!s.enabled) return;
      const def = SO.Registry.get(s.visualizer);
      if (!def || this.failed.has(def.id)) return;
      const active = f.live || f.energy > 0.004;
      if (!active && !def.drawsWhenIdle) return;

      const rm = app.reduced;
      this.time += dt * (s.audio.animationSpeed / 100);
      const r = this.rect(s);
      let { cx, cy } = r;
      let scale = r.scale;
      if (s.effects.beatScale && !rm) scale *= 1 + (s.effects.beatAmount / 100) * f.beat;
      if (s.effects.subtleMotion && !rm) { cx += Math.sin(this.time * 0.35) * this.W * 0.004; cy += Math.cos(this.time * 0.27) * this.H * 0.004; }

      let st = this.states.get(def.id); if (!st) { st = {}; this.states.set(def.id, st); }
      const c = this.c;
      c.ctx = ctx; c.w = r.w; c.h = r.h; c.dt = dt; c.time = this.time; c.f = f; c.s = s;
      c.o = Object.assign({}, def.defaults, s.viz[def.id]); c.cs = app.colorSource; c.meta = app.meta; c.art = app.art;
      c.st = st; c.dpr = this.dpr; c.rm = rm; c.viewW = this.W; c.viewH = this.H;

      ctx.save();
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.translate(cx, cy); ctx.rotate(r.rot); ctx.scale(scale, scale); ctx.translate(-r.w / 2, -r.h / 2);
      if (s.color.bgFill && s.color.bgOpacity > 0) { ctx.globalAlpha = s.color.bgOpacity / 100; ctx.fillStyle = s.color.bgColor; ctx.fillRect(0, 0, r.w, r.h); }
      ctx.globalAlpha = s.color.opacity / 100;
      try { def.render(c); }
      catch (e) { console.error('[SonicOverlay] renderer "' + def.id + '" failed:', e); this.failed.add(def.id); }
      ctx.restore();

      if (!def.drawsMeta) {
        ctx.save(); ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); ctx.globalAlpha = s.color.opacity / 100;
        SO.H.drawMeta(c, cx - r.w * scale / 2, cy - r.h * scale / 2, r.w * scale, r.h * scale, this.H);
        ctx.restore();
      }
    }
  };
})(typeof self !== 'undefined' ? self : this);
