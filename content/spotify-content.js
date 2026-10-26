/* SonicOverlay - content script controller for open.spotify.com.
   Owns the click-through overlay host, canvas render loop, frame ingestion, album-art palette, edit mode and the settings panel. */
(function () {
  'use strict';
  if (window.__sonicOverlayLoaded) return;          // never inject twice (SPA navigation, re-injection)
  window.__sonicOverlayLoaded = true;
  const SO = window.SO, U = SO.Util, el = U.el, C = SO.Color, MSG = SO.MSG, SS = SO.SettingsStore;
  const HOST_ID = 'sonic-overlay-root';
  const old = document.getElementById(HOST_ID); if (old) old.remove();

  init().catch((e) => console.error('[SonicOverlay] init failed', e));

  async function init() {
    const settings = await SS.load();
    SS.snapshotSession(settings);
    const ctrl = SS.createController(settings); ctrl.listenExternal();
    const S = () => ctrl.settings;

    const app = {
      get settings() { return ctrl.settings; }, frame: new SO.FrameProcessor(), meta: { title: '', artist: '', artUrl: '', available: false, position: 0, duration: 0 },
      art: { img: null, status: 'none' }, colorSource: null, reduced: false,
      capture: { status: 'idle', error: null, thisTab: false }
    };

    // ---------- DOM: one host, shadow root, canvas never receives pointer events ----------
    const host = el('div', { id: HOST_ID });
    const shadow = host.attachShadow({ mode: 'open' });
    const links = ['content/overlay.css', 'settings/settings.css'].map((p) => el('link', { rel: 'stylesheet', href: chrome.runtime.getURL(p) }));
    const canvas = el('canvas', { class: 'so-canvas', 'aria-hidden': 'true' });
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;background:transparent;';
    const toast = el('div', { class: 'so-toast', role: 'status', hidden: true });
    const editLayer = el('div', { class: 'so-edit', hidden: true });
    shadow.append(...links, canvas, editLayer, toast);
    const attach = (parent) => { (parent || document.documentElement).append(host); };
    attach();
    const mgr = new SO.RendererManager(canvas);

    // ---------- toast ----------
    let toastTimer = null;
    function showToast(title, body, ms) {
      toast.replaceChildren(el('b', { text: title }), body ? el('span', { text: body }) : null); toast.hidden = false;
      clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.hidden = true; }, ms || 7000);
    }

    // ---------- resize / fullscreen / re-attach ----------
    function resize() { mgr.resize(window.innerWidth, window.innerHeight, Math.min(window.devicePixelRatio || 1, 2)); updateEdit(); panel && panel.place(); }
    window.addEventListener('resize', resize);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
    document.addEventListener('fullscreenchange', () => {
      const fs = document.fullscreenElement;
      attach(fs && !/^(VIDEO|IMG|IFRAME|CANVAS|INPUT)$/.test(fs.tagName) ? fs : document.documentElement);
      setTimeout(resize, 50);
    });
    const keepAttached = new MutationObserver(() => { if (!host.isConnected) attach(document.fullscreenElement && !/^(VIDEO|IMG|IFRAME|CANVAS)$/.test(document.fullscreenElement.tagName) ? document.fullscreenElement : document.documentElement); });
    keepAttached.observe(document.documentElement, { childList: true });

    // ---------- settings panel ----------
    let editMode = false;
    const hooks = {
      getEdit: () => editMode, setEdit: (v) => setEdit(v),
      resetRenderer: (all) => { if (all) mgr.resetAll(); else mgr.resetState(S().visualizer); },
      trackProgress: (on) => metaReader.trackProgress(on)
    };
    let panel = null;
    await Promise.race([Promise.all(links.map((l) => new Promise((r) => { l.addEventListener('load', r); l.addEventListener('error', r); }))), new Promise((r) => setTimeout(r, 1500))]);
    panel = SO.SettingsPanel.create({ ctrl, hooks, mode: 'overlay' });
    shadow.append(panel.el);
    resize();

    // ---------- Spotify metadata + album art palette ----------
    const metaReader = new SO.SpotifyMeta(onTrack);
    let artToken = 0;
    const pal = { cur: null, weight: 0, target: null };
    function onTrack(m) { app.meta = m; loadArt(m.artUrl); }
    function paletteFrom(img) {
      const cv = document.createElement('canvas'); cv.width = cv.height = 48;
      const x = cv.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, 48, 48);
      return C.extractPalette(x.getImageData(0, 0, 48, 48).data);
    }
    function loadImg(url, cors) {
      return new Promise((res, rej) => {
        const im = new Image(); if (cors) im.crossOrigin = 'anonymous';
        const t = setTimeout(() => rej(new Error('timeout')), 8000);
        im.onload = () => { clearTimeout(t); res(im); }; im.onerror = () => { clearTimeout(t); rej(new Error('load failed')); }; im.src = url;
      });
    }
    async function loadArt(url) {
      const token = ++artToken;
      if (!url) { app.art = { img: null, status: 'none' }; pal.target = null; return; }
      const cands = [url.replace('ab67616d00004851', 'ab67616d00001e02'), url].filter((v, i, a) => a.indexOf(v) === i);
      for (const u of cands) {
        let img = null, palette = null;
        try { img = await loadImg(u, true); palette = paletteFrom(img); }                       // 1) CORS image
        catch (e) {
          try {                                                                                  // 2) service-worker fetch (host permission) -> data URL
            const r = await U.send({ type: MSG.FETCH_IMAGE, url: u });
            if (r && r.ok && r.dataUrl) { img = await loadImg(r.dataUrl, false); palette = paletteFrom(img); }
          } catch (e2) { img = null; palette = null; }
        }
        if (token !== artToken) return;
        if (img && palette) { app.art = { img, status: 'ok' }; pal.target = palette; return; }
      }
      try { const img = await loadImg(url, false); if (token === artToken) { app.art = { img, status: 'no-palette' }; pal.target = null; } }  // 3) display-only
      catch (e) { if (token === artToken) { app.art = { img: null, status: 'failed' }; pal.target = null; } }
    }
    function updatePalette(dt) {
      const tw = pal.target ? 1 : 0;
      if (pal.target && (!pal.cur || pal.weight < 0.02)) pal.cur = pal.target.map((c) => c.slice());
      const k = 1 - Math.exp(-dt * 2.6);
      if (pal.cur && pal.target) for (let i = 0; i < 3; i++) pal.cur[i] = C.lerpRgb(pal.cur[i], pal.target[i], k);
      pal.weight += (tw - pal.weight) * k;
    }

    // ---------- capture state, frames ----------
    let port = null, captureSince = 0, staleToasted = false;
    function connectPort() {
      if (port) return;
      try {
        port = chrome.runtime.connect({ name: SO.PORT_FRAMES });
        port.onMessage.addListener((m) => onFrame(m));
        port.onDisconnect.addListener(() => { port = null; void chrome.runtime.lastError; });
      } catch (e) { port = null; }
    }
    function disconnectPort() { try { if (port) port.disconnect(); } catch (e) { /* ignore */ } port = null; }
    function onFrame(m) { if (m && m.type === MSG.FRAME && SO.Validation.validateMessage(m)) app.frame.ingest(m, performance.now()); }
    function setCapture(m) {
      const prev = app.capture.status;
      app.capture = { status: m.status, error: m.error || null, thisTab: !!m.thisTab };
      if (m.status === 'capturing' && m.thisTab) { if (prev !== 'capturing') { captureSince = performance.now(); staleToasted = false; } connectPort(); }
      else { disconnectPort(); app.frame.lastFrameAt = 0; }
      if (m.status === 'error' && m.error) showToast(m.error.message, m.error.hint, 9000);
      reportStatus(true);
    }
    U.send({ type: MSG.CAPTURE_GET_STATUS }).then((r) => { if (r && r.ok && r.status) setCapture(r); });

    let lastStatusKey = '';
    function reportStatus(force) {
      const now = performance.now(), cap = app.capture;
      const capturingHere = cap.status === 'capturing' && cap.thisTab;
      const stale = capturingHere && now - captureSince > 3000 && now - app.frame.lastFrameAt > 2500;
      const silent = capturingHere && !stale && app.frame.silentFor > 3;
      if (stale && !staleToasted && now - captureSince > 6000) { staleToasted = true; const e = SO.makeError('NO_DATA'); showToast(e.message, e.hint, 9000); }
      if (stale && !port) connectPort();
      const info = { capture: cap, stale, silent, meta: { available: app.meta.available, title: app.meta.title, artist: app.meta.artist }, artStatus: app.art.status };
      const key = JSON.stringify(info);
      if (force || key !== lastStatusKey) { lastStatusKey = key; panel.setStatus(info); }
      if (pal.cur && pal.weight > 0.3) {
        panel.setAccent(pal.cur[0]); editLayer.style.setProperty('--so-accent', 'rgb(' + pal.cur[0].map(Math.round).join(',') + ')');
      } else {
        panel.setAccent([138, 180, 255]); editLayer.style.setProperty('--so-accent', '#8ab4ff');
      }
    }
    setInterval(reportStatus, 500);

    // ---------- edit mode (explicit handles only) ----------
    const frameEl = el('div', { class: 'so-edit-frame' });
    const moveH = el('button', { type: 'button', class: 'so-handle so-handle--move', text: 'Drag to move', 'aria-label': 'Move visualizer. Use arrow keys to nudge.' });
    const sizeH = el('button', { type: 'button', class: 'so-handle so-handle--resize', 'aria-label': 'Resize visualizer' });
    const doneH = el('button', { type: 'button', class: 'so-handle so-handle--done', text: 'Done', 'aria-label': 'Finish editing and restore click-through' });
    frameEl.append(moveH, doneH, sizeH); editLayer.append(frameEl);
    function updateEdit() {
      if (!editMode) return;
      const r = mgr.rect(S()), w = r.w * r.scale, h = r.h * r.scale;
      Object.assign(frameEl.style, { left: r.cx - w / 2 + 'px', top: r.cy - h / 2 + 'px', width: w + 'px', height: h + 'px', transform: 'rotate(' + r.rot + 'rad)' });
      const isTop = r.cy - h / 2 < 44;
      frameEl.classList.toggle('is-top', isTop);
      moveH.style.top = isTop ? '8px' : ''; doneH.style.top = isTop ? '8px' : '';
      moveH.textContent = w < 220 ? 'Move' : 'Drag to move';
      if (w < 160 && isTop) { doneH.style.right = '-65px'; } else { doneH.style.right = '0'; }
    }
    function setEdit(v) {
      if (v && S().layout.locked) { showToast('Layout is locked', 'Turn off \u201cLock position\u201d in Position & layout to edit.'); panel.refresh(); return; }
      editMode = !!v; editLayer.hidden = !editMode; updateEdit(); panel.refresh();
      if (editMode) showToast('Edit mode', 'Drag the handle to move, the corner to resize. Press Done or Esc to restore click-through.', 6000);
    }
    doneH.addEventListener('click', () => setEdit(false));
    editLayer.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); setEdit(false); } });
    document.addEventListener('keydown', (e) => { if (editMode && e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); setEdit(false); } }, true);
    function snapped(cx, cy, w, h) {
      if (!S().layout.snap) return [cx, cy];
      const W = window.innerWidth, Hh = window.innerHeight, T = 12;
      if (Math.abs(cx - w / 2) < T) cx = w / 2; else if (Math.abs(cx + w / 2 - W) < T) cx = W - w / 2; else if (Math.abs(cx - W / 2) < T) cx = W / 2;
      if (Math.abs(cy - h / 2) < T) cy = h / 2; else if (Math.abs(cy + h / 2 - Hh) < T) cy = Hh - h / 2; else if (Math.abs(cy - Hh / 2) < T) cy = Hh / 2;
      return [cx, cy];
    }
    moveH.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return; moveH.setPointerCapture(e.pointerId);
      const r = mgr.rect(S()), sx = e.clientX, sy = e.clientY;
      const move = (ev) => {
        const [cx, cy] = snapped(r.cx + ev.clientX - sx, r.cy + ev.clientY - sy, r.w * r.scale, r.h * r.scale);
        ctrl.set('layout.x', cx / window.innerWidth * 100); ctrl.set('layout.y', cy / window.innerHeight * 100); updateEdit();
      };
      const up = () => { moveH.removeEventListener('pointermove', move); moveH.removeEventListener('pointerup', up); panel.refresh(); };
      moveH.addEventListener('pointermove', move); moveH.addEventListener('pointerup', up);
    });
    moveH.addEventListener('keydown', (e) => {
      const d = e.shiftKey ? 5 : 1, m = { ArrowLeft: ['layout.x', -d], ArrowRight: ['layout.x', d], ArrowUp: ['layout.y', -d], ArrowDown: ['layout.y', d] }[e.key];
      if (m) { e.preventDefault(); e.stopPropagation(); ctrl.set(m[0], ctrl.get(m[0]) + m[1]); updateEdit(); panel.refresh(); }
    });
    sizeH.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return; sizeH.setPointerCapture(e.pointerId); e.stopPropagation();
      const r = mgr.rect(S()), sx = e.clientX, sy = e.clientY, ca = Math.cos(r.rot), sa = Math.sin(r.rot);
      const move = (ev) => {
        const dx = ev.clientX - sx, dy = ev.clientY - sy, dw = dx * ca + dy * sa, dh = -dx * sa + dy * ca;
        const ew = Math.max(30, r.w * r.scale + 2 * dw), eh = Math.max(30, r.h * r.scale + 2 * dh);
        ctrl.set('layout.width', U.clamp(ew / r.scale / window.innerWidth * 100, 2, 200)); ctrl.set('layout.height', U.clamp(eh / r.scale / window.innerHeight * 100, 2, 200)); updateEdit();
      };
      const up = () => { sizeH.removeEventListener('pointermove', move); sizeH.removeEventListener('pointerup', up); panel.refresh(); };
      sizeH.addEventListener('pointermove', move); sizeH.addEventListener('pointerup', up);
    });

    // ---------- commands / messages ----------
    function runCommand(cmd) {
      if (cmd === 'toggle-overlay') ctrl.set('enabled', !S().enabled);
      else if (cmd === 'toggle-panel') ctrl.set('ui.panelVisible', !S().ui.panelVisible);
      else if (cmd === 'toggle-edit') setEdit(!editMode);
    }
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (!SO.Validation.validateMessage(msg, sender)) return false;
      switch (msg.type) {
        case MSG.FRAME: onFrame(msg); return false;
        case MSG.CAPTURE_STATUS: setCapture(msg); return false;
        case MSG.OVERLAY_COMMAND: runCommand(msg.command); return false;
        case MSG.OVERLAY_GET_STATE: sendResponse({ ok: true, enabled: S().enabled, panelVisible: S().ui.panelVisible, editMode, meta: app.meta, capture: app.capture }); return false;
        default: return false;
      }
    });

    // ---------- reacting to settings changes ----------
    let lastFft = S().audio.fftSize, lastBlend = '';
    function applySettings() {
      const s = S();
      if (s.color.blendMode !== lastBlend) { lastBlend = s.color.blendMode; canvas.style.mixBlendMode = lastBlend; }
      canvas.style.display = s.enabled ? 'block' : 'none';
      if (s.audio.fftSize !== lastFft) { lastFft = s.audio.fftSize; U.send({ type: MSG.OFFSCREEN_CONFIG, fftSize: lastFft }); }
      if (s.layout.locked && editMode) setEdit(false);
      syncLoop(); updateEdit();
    }
    ctrl.subscribe(() => applySettings());
    metaReader.trackProgress(S().meta.showProgress);

    // ---------- render loop ----------
    const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
    let raf = 0, last = 0;
    function loop(now) {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
      const s = S();
      app.reduced = s.reducedMotion || mq.matches;
      app.frame.update(dt, s.audio, performance.now(), app.reduced);
      updatePalette(dt);
      app.colorSource = C.makeColorSource(s.color, pal.cur && pal.weight > 0.01 ? { rgb: pal.cur, weight: pal.weight } : null, mgr.time, s.effects.colorShift && !app.reduced ? (mgr.time * 8) % 360 : 0);
      mgr.render(app, dt);
    }
    function syncLoop() {
      const run = S().enabled && !document.hidden;
      if (run && !raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
      else if (!run && raf) { cancelAnimationFrame(raf); raf = 0; mgr.ctx.setTransform(1, 0, 0, 1, 0, 0); mgr.ctx.clearRect(0, 0, canvas.width, canvas.height); }
    }
    document.addEventListener('visibilitychange', syncLoop);

    // ---------- lifecycle ----------
    const watchdog = setInterval(() => {
      if (U.extensionAlive()) return;
      clearInterval(watchdog); cancelAnimationFrame(raf); raf = 0; metaReader.stop(); disconnectPort(); keepAttached.disconnect();
      mgr.ctx.clearRect(0, 0, canvas.width, canvas.height); panel.destroy(); editLayer.hidden = true;
      const e = SO.makeError('CONTEXT_INVALIDATED'); showToast(e.message, e.hint, 12000); setTimeout(() => host.remove(), 12500);
    }, 3000);

    metaReader.start();
    applySettings();
    panel.refresh();
    reportStatus(true);
  }
})();
