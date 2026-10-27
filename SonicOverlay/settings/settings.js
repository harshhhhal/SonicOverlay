/* SonicOverlay - settings UI. Used as the floating in-page panel (overlay mode) and the options page (page mode). */
(function (root) {
  'use strict';
  const SO = (root.SO = root.SO || {});
  const U = SO.Util, el = U.el, SS = SO.SettingsStore;
  const pct = (v) => Math.round(v) + '%', px = (v) => Math.round(v) + 'px', num1 = (v) => (Math.round(v * 10) / 10).toString(), plain = (v) => String(Math.round(v * 10) / 10);

  function create(opts) {
    const ctrl = opts.ctrl, hooks = opts.hooks || {}, page = opts.mode === 'page';
    const controls = [];       // static controls refreshed on structural changes
    const dynamics = [];       // sections whose contents are rebuilt
    const pending = [];        // section elements in display order
    const S = () => ctrl.settings;

    // ---------- control factories ----------
    const P = (path) => ({ get: () => ctrl.get(path), set: (v) => ctrl.set(path, v) });
    const VZ = (key) => ({
      get: () => { const d = SO.Registry.get(S().visualizer); return Object.assign({}, d && d.defaults, S().viz[S().visualizer])[key]; },
      set: (v) => ctrl.set('viz.' + S().visualizer + '.' + key, v)
    });
    const track = (list, c) => { list.push(c); return c.el; };

    function range(list, label, acc, min, max, step, fmt, o) {
      const out = el('output'), inp = el('input', { type: 'range', min, max, step: step || 1, 'aria-label': label });
      const f = fmt || plain;
      inp.addEventListener('input', () => { const v = Number(inp.value); acc.set(v); out.textContent = f(v); });
      const row = el('label', { class: 'so-row so-range' }, el('span', { class: 'so-label', text: label }), out, inp);
      return track(list, { el: row, update() { const v = acc.get(); inp.value = v; out.textContent = f(v); inp.disabled = !!(o && o.lockable && ctrl.get('layout.locked')); } });
    }
    function toggle(list, label, acc, onChange) {
      const inp = el('input', { type: 'checkbox', role: 'switch' });
      inp.addEventListener('change', () => { acc.set(inp.checked); if (onChange) onChange(inp.checked); });
      const row = el('label', { class: 'so-row so-toggle' }, el('span', { class: 'so-label', text: label }), inp, el('span', { class: 'so-switch', 'aria-hidden': 'true' }));
      return track(list, { el: row, update() { inp.checked = !!acc.get(); } });
    }
    function select(list, label, acc, options) {
      const sel = el('select', { 'aria-label': label }, options.map(([v, t]) => el('option', { value: String(v), text: t })));
      const numeric = typeof options[0][0] === 'number';
      sel.addEventListener('change', () => acc.set(numeric ? Number(sel.value) : sel.value));
      const row = el('label', { class: 'so-row so-select' }, el('span', { class: 'so-label', text: label }), sel);
      return track(list, { el: row, update() { sel.value = String(acc.get()); } });
    }
    function color(list, label, acc) {
      const inp = el('input', { type: 'color', 'aria-label': label });
      inp.addEventListener('input', () => acc.set(inp.value));
      const row = el('label', { class: 'so-row so-color' }, el('span', { class: 'so-label', text: label }), inp);
      return track(list, { el: row, update() { inp.value = acc.get(); } });
    }
    const button = (text, fn, cls) => el('button', { type: 'button', class: 'so-btn ' + (cls || ''), text, onclick: fn });
    const note = (text) => el('p', { class: 'so-note', text });

    // ---------- sections ----------
    function section(id, title, fill) {
      const body = el('div', { class: 'so-section__body' }), head = el('button', { type: 'button', class: 'so-section__head', 'aria-expanded': 'true' }, el('span', { text: title }), el('span', { class: 'so-chev', 'aria-hidden': 'true' }));
      const wrap = el('section', { class: 'so-section' }, el('h3', { class: 'so-h' }, head), body);
      const apply = () => { const c = !!ctrl.get('ui.collapsed.' + id); wrap.classList.toggle('is-collapsed', c); head.setAttribute('aria-expanded', String(!c)); };
      head.addEventListener('click', () => { ctrl.set('ui.collapsed.' + id, !ctrl.get('ui.collapsed.' + id)); apply(); });
      fill(body);
      controls.push({ update: apply });
      pending.push(wrap);
      return wrap;
    }
    function dynamic(host, build, keyFn) {
      const local = []; let key = null;
      const d = {
        render() { host.replaceChildren(); local.length = 0; build(host, local); local.forEach((c) => c.update()); key = keyFn(); },
        update() { if (keyFn() !== key) d.render(); else local.forEach((c) => c.update()); }
      };
      dynamics.push(d); d.render(); return d;
    }

    // General
    const picker = el('div', { class: 'so-picker', role: 'radiogroup', 'aria-label': 'Visualizer' });
    const pickerBtns = [];
    function selectViz(id) {
      ctrl.mutate((s) => {
        s.visualizer = id; s.presetName = 'Custom';
        const def = SO.Registry.get(id), L = def && SO.LAYOUTS[def.layout];
        if (L && !s.layout.locked) Object.assign(s.layout, { x: L.x, y: L.y, width: L.width, height: L.height });
      });
    }
    for (const def of SO.Registry.list()) {
      const cv = el('canvas', { width: 44, height: 30, 'aria-hidden': 'true' });
      SO.H.icon(def.icon, cv.getContext('2d'), 44, 30, '#b9bfcc');
      const b = el('button', { type: 'button', class: 'so-pick', role: 'radio', 'aria-checked': 'false', title: def.name, onclick: () => selectViz(def.id) }, cv, el('span', { text: def.name }));
      pickerBtns.push([def.id, b]); picker.append(b);
    }

    const statusBox = el('div', { class: 'so-status', role: 'status', 'aria-live': 'polite' },
      el('div', { class: 'so-status__line' }, el('span', { class: 'so-dot' }), el('strong', { class: 'so-status__title' })), el('p', { class: 'so-status__hint' }), el('p', { class: 'so-status__meta' }));

    section('general', 'General', (b) => {
      toggle(controls, 'Overlay enabled', P('enabled')); b.append(controls[controls.length - 1].el);
      b.append(picker);
      if (!page) {
        const editRow = toggle(controls, 'Edit layout (drag & resize)', { get: () => (hooks.getEdit ? hooks.getEdit() : false), set: (v) => hooks.setEdit && hooks.setEdit(v) });
        b.append(editRow);
      }
      b.append(controlsPush(toggle, 'Compact controls', P('ui.compact')), controlsPush(toggle, 'Reduce motion', P('reducedMotion')));
      b.append(el('div', { class: 'so-btnrow' },
        button('Reset visualizer', () => { ctrl.mutate((s) => { delete s.viz[s.visualizer]; }); hooks.resetRenderer && hooks.resetRenderer(); }),
        confirmButton('Reset all', () => { ctrl.mutate((s) => { const ui = s.ui; Object.assign(s, SS.defaults(), { ui }); }); hooks.resetRenderer && hooks.resetRenderer(true); }),
        button('Undo session changes', async () => { const prev = await SS.loadSession(); if (prev) { const ui = S().ui; prev.ui = ui; ctrl.replace(prev); hooks.resetRenderer && hooks.resetRenderer(true); } })));
    });
    function controlsPush(factory, ...args) { return factory(controls, ...args); }
    function confirmButton(text, fn) {
      let armed = false, t = null; const b = button(text, () => {
        if (!armed) { armed = true; b.textContent = 'Click again to confirm'; b.classList.add('is-armed'); t = setTimeout(reset, 4000); return; }
        reset(); fn();
      }, 'so-btn--danger');
      function reset() { armed = false; clearTimeout(t); b.textContent = text; b.classList.remove('is-armed'); }
      return b;
    }

    // Visualizer-specific options (generated from the renderer's control schema)
    const vizHost = el('div');
    section('viz', 'Visualizer options', (b) => b.append(vizHost));
    dynamic(vizHost, (host, local) => {
      const def = SO.Registry.get(S().visualizer); if (!def) return;
      for (const c of def.controls) {
        const acc = VZ(c.key);
        if (c.type === 'range') host.append(range(local, c.label, acc, c.min, c.max, c.step, plain));
        else if (c.type === 'toggle') host.append(toggle(local, c.label, acc));
        else if (c.type === 'select') host.append(select(local, c.label, acc, c.options));
        else if (c.type === 'color') host.append(color(local, c.label, acc));
      }
    }, () => S().visualizer);

    // Appearance
    // Appearance
    const stopsHost = el('div', { class: 'so-stops' });
    let primColorRow, secColorRow, gradAngleRow, bgColorRow, bgOpRow;
    section('appearance', 'Color & appearance', (b) => {
      primColorRow = color(controls, 'Primary color', P('color.primary'));
      secColorRow = color(controls, 'Secondary color', P('color.secondary'));
      gradAngleRow = range(controls, 'Gradient direction', P('color.gradientAngle'), 0, 360, 5, (v) => Math.round(v) + '\u00b0');
      bgColorRow = color(controls, 'Background color', P('color.bgColor'));
      bgOpRow = range(controls, 'Background opacity', P('color.bgOpacity'), 0, 100, 1, pct);

      b.append(
        controlsPush(select, 'Color mode', P('color.mode'), [['gradient', 'Gradient'], ['solid', 'Solid'], ['rainbow', 'Rainbow'], ['mono', 'Monochrome']]),
        controlsPush(range, 'Match album art colors', P('color.artInfluence'), 0, 100, 1, pct),
        note('Pulls colors from the current track\u2019s cover and fades between songs. 0% uses only the colors below.'),
        primColorRow, secColorRow, stopsHost, gradAngleRow,
        controlsPush(range, 'Opacity', P('color.opacity'), 0, 100, 1, pct),
        controlsPush(range, 'Glow intensity', P('color.glowIntensity'), 0, 100, 1, pct),
        controlsPush(range, 'Glow radius', P('color.glowRadius'), 0, 60, 1, px),
        controlsPush(toggle, 'Drop shadow (when glow is 0)', P('color.shadow')),
        controlsPush(toggle, 'Background fill behind visualizer', P('color.bgFill')),
        bgColorRow, bgOpRow,
        controlsPush(select, 'Blend mode', P('color.blendMode'), SS.ENUMS['color.blendMode'].map((m) => [m, m])));
    });
    dynamic(stopsHost, (host, local) => {
      const stops = S().color.stops;
      stops.forEach((st, i) => {
        const c = color(local, 'Stop ' + (i + 1), P('color.stops.' + i + '.color'));
        const pos = range(local, 'Position', { get: () => Math.round(ctrl.get('color.stops.' + i + '.pos') * 100), set: (v) => ctrl.set('color.stops.' + i + '.pos', v / 100) }, 5, 95, 1, pct);
        host.append(el('div', { class: 'so-stop' }, c, pos, button('Remove stop', () => ctrl.mutate((s) => { s.color.stops.splice(i, 1); }), 'so-btn--ghost')));
      });
      if (stops.length < 3) host.append(button('Add gradient stop', () => ctrl.mutate((s) => { s.color.stops.push({ pos: 0.5, color: '#ffffff' }); }), 'so-btn--ghost'));
    }, () => S().color.stops.length + ':' + S().color.stops.map((s) => s.pos + s.color).join(','));

    // Audio reactivity
    section('audio', 'Audio reactivity', (b) => {
      const A = (k) => P('audio.' + k);
      b.append(controlsPush(range, 'Sensitivity', A('sensitivity'), 0, 200, 1, pct), controlsPush(range, 'Bass boost', A('bassBoost'), 0, 200, 1, pct),
        controlsPush(range, 'Mid response', A('midResponse'), 0, 200, 1, pct), controlsPush(range, 'High response', A('highResponse'), 0, 200, 1, pct),
        controlsPush(range, 'Smoothing', A('smoothing'), 0, 95, 1, pct), controlsPush(range, 'Decay', A('decay'), 0, 100, 1, pct),
        controlsPush(range, 'Waveform amplitude', A('amplitude'), 0, 300, 1, pct), controlsPush(range, 'Peak hold', A('peakHold'), 0, 100, 1, pct),
        controlsPush(range, 'Animation speed', A('animationSpeed'), 10, 300, 1, pct),
        controlsPush(select, 'FFT size', A('fftSize'), SO.FFT_SIZES.map((n) => [n, String(n)])));
      b.append(note('Larger FFT sizes resolve bass more precisely but react a little slower.'));
    });

    // Effects
    section('effects', 'Effects', (b) => {
      const E = (k) => P('effects.' + k);
      b.append(controlsPush(range, 'Particle density', E('particleDensity'), 0, 100, 1, pct), controlsPush(range, 'Particle speed', E('particleSpeed'), 10, 300, 1, pct),
        controlsPush(range, 'Particle size', E('particleSize'), 1, 16, 0.5, px), controlsPush(range, 'Particle lifetime', E('particleLifetime'), 0.5, 12, 0.5, (v) => num1(v) + 's'),
        controlsPush(range, 'Blur', E('blur'), 0, 20, 1, px), controlsPush(range, 'Wave distortion', E('waveDistortion'), 0, 100, 1, pct),
        controlsPush(toggle, 'Beat-responsive scaling', E('beatScale')), controlsPush(range, 'Beat scale amount', E('beatAmount'), 0, 40, 1, pct),
        controlsPush(toggle, 'Ambient color shift', E('colorShift')), controlsPush(toggle, 'Subtle motion', E('subtleMotion')));
    });

    // Layout
    const alignGrid = el('div', { class: 'so-align', role: 'group', 'aria-label': 'Align visualizer' });
    const alignCells = [];
    const H3 = ['left', 'center', 'right'], V3 = ['top', 'center', 'bottom'];
    function align(h, v) {
      if (S().layout.locked) return;
      ctrl.mutate((s) => {
        const L = s.layout, w = L.width * L.scale / 100, hh = L.height * L.scale / 100;
        L.x = h === 'left' ? w / 2 : h === 'right' ? 100 - w / 2 : 50; L.y = v === 'top' ? hh / 2 : v === 'bottom' ? 100 - hh / 2 : 50;
      });
    }
    for (const v of V3) for (const h of H3) {
      const cell = el('button', { type: 'button', class: 'so-align__cell', 'aria-label': 'Align ' + v + ' ' + h, title: v + ' ' + h, onclick: () => align(h, v) });
      alignCells.push(cell); alignGrid.append(cell);
    }
    const alignRow = el('div', { class: 'so-row' }, el('span', { class: 'so-label', text: 'Quick align' }), alignGrid);
    const lay = el('select', { 'aria-label': 'Predefined layout' }, el('option', { value: '', text: 'Choose a layout\u2026' }), Object.entries(SO.LAYOUTS).map(([k, v]) => el('option', { value: k, text: v.label })));
    lay.addEventListener('change', () => { const L = SO.LAYOUTS[lay.value]; if (L && !S().layout.locked) ctrl.mutate((s) => Object.assign(s.layout, { x: L.x, y: L.y, width: L.width, height: L.height })); lay.value = ''; });
    const resetPosBtn = button('Reset position', () => { if (S().layout.locked) return; const d = SO.Registry.get(S().visualizer), L = SO.LAYOUTS[d && d.layout] || SO.LAYOUTS.bottom; ctrl.mutate((s) => Object.assign(s.layout, { x: L.x, y: L.y, width: L.width, height: L.height, rotation: 0, scale: 100 })); });
    section('layout', 'Position & layout', (b) => {
      const Lp = (k) => P('layout.' + k);
      b.append(controlsPush(range, 'X position', Lp('x'), -20, 120, 0.5, pct, { lockable: true }), controlsPush(range, 'Y position', Lp('y'), -20, 120, 0.5, pct, { lockable: true }),
        controlsPush(range, 'Width', Lp('width'), 2, 200, 0.5, pct, { lockable: true }), controlsPush(range, 'Height', Lp('height'), 2, 200, 0.5, pct, { lockable: true }),
        controlsPush(range, 'Rotation', Lp('rotation'), -180, 180, 1, (v) => Math.round(v) + '\u00b0', { lockable: true }), controlsPush(range, 'Scale', Lp('scale'), 10, 300, 1, pct, { lockable: true }),
        controlsPush(toggle, 'Snap to viewport edges', Lp('snap')), controlsPush(toggle, 'Lock position', Lp('locked')), alignRow,
        el('label', { class: 'so-row so-select' }, el('span', { class: 'so-label', text: 'Predefined layout' }), lay), resetPosBtn);
    });

    // Track info
    const metaLine = el('p', { class: 'so-note' });
    section('meta', 'Artwork & track info', (b) => {
      const M = (k) => P('meta.' + k);
      b.append(metaLine, controlsPush(toggle, 'Show artwork (Album Art Ring)', M('showArt')), controlsPush(range, 'Artwork size', M('artSize'), 60, 600, 5, px),
        controlsPush(toggle, 'Show track title', M('showTitle')), controlsPush(toggle, 'Show artist', M('showArtist')), controlsPush(toggle, 'Show progress', M('showProgress'), (v) => hooks.trackProgress && hooks.trackProgress(v)),
        controlsPush(select, 'Font', M('fontFamily'), [['system', 'System'], ['serif', 'Serif'], ['mono', 'Monospace'], ['rounded', 'Rounded'], ['condensed', 'Condensed']]),
        controlsPush(range, 'Font size', M('fontSize'), 10, 64, 1, px), controlsPush(range, 'Font weight', M('fontWeight'), 300, 900, 100, plain),
        controlsPush(select, 'Text alignment', M('textAlign'), [['left', 'Left'], ['center', 'Center'], ['right', 'Right']]),
        controlsPush(select, 'Text placement', M('textPlacement'), [['below', 'Below visualizer'], ['above', 'Above visualizer'], ['center', 'Centered']]),
        controlsPush(color, 'Text color', M('textColor')), controlsPush(toggle, 'Text shadow', M('textShadow')));
    });

    // Presets
    const presetNote = el('p', { class: 'so-note', role: 'status', 'aria-live': 'polite' });
    const presetSel = el('select', { 'aria-label': 'Preset' });
    const nameInput = el('input', { type: 'text', class: 'so-text', maxlength: 40, placeholder: 'Preset name', 'aria-label': 'Preset name' });
    const fileInput = el('input', { type: 'file', accept: 'application/json,.json', hidden: true });
    const PS = SO.PresetStore;
    const say = (m, bad) => { presetNote.textContent = m; presetNote.classList.toggle('is-bad', !!bad); };
    async function loadPresetList(selected) {
      const names = await PS.list(); presetSel.replaceChildren(...names.map((n) => el('option', { value: n, text: n })));
      const want = selected || S().presetName; presetSel.value = names.includes(want) ? want : names[0];
      nameInput.value = presetSel.value || '';
    }
    async function guard(fn) { try { await fn(); } catch (e) { say(e && e.message ? e.message : 'That did not work.', true); } }
    presetSel.addEventListener('change', () => guard(async () => {
      const snap = await PS.get(presetSel.value); if (!snap) throw new Error('Preset not found.');
      ctrl.replace(PS.applyTo(S(), snap, presetSel.value)); nameInput.value = presetSel.value; hooks.resetRenderer && hooks.resetRenderer(true); say('Loaded \u201c' + presetSel.value + '\u201d.');
    }));
    section('presets', 'Presets', (b) => {
      b.append(el('label', { class: 'so-row so-select' }, el('span', { class: 'so-label', text: 'Preset' }), presetSel), nameInput,
        el('div', { class: 'so-btnrow' },
          button('Save', () => guard(async () => { const n = await PS.save(nameInput.value, S()); ctrl.set('presetName', n); await loadPresetList(n); say('Saved \u201c' + n + '\u201d.'); })),
          button('Rename', () => guard(async () => { const n = await PS.rename(presetSel.value, nameInput.value); if (S().presetName === presetSel.value) ctrl.set('presetName', n); await loadPresetList(n); say('Renamed.'); })),
          button('Duplicate', () => guard(async () => { const n = await PS.duplicate(presetSel.value); await loadPresetList(n); say('Created \u201c' + n + '\u201d.'); })),
          confirmButton('Delete', () => guard(async () => {
            const n = presetSel.value;
            if (!n) throw new Error('No preset selected.');
            await PS.remove(n);
            if (S().presetName === n) ctrl.set('presetName', 'Custom');
            await loadPresetList('Custom');
            say('Deleted \u201c' + n + '\u201d.');
          }))),
        el('div', { class: 'so-btnrow' },
          button('Export', () => guard(async () => {
            const json = await PS.exportJSON(); const a = el('a', { href: URL.createObjectURL(new Blob([json], { type: 'application/json' })), download: 'sonicoverlay-presets.json' });
            document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); say('Exported all presets.');
          })),
          button('Import', () => fileInput.click()), fileInput,
          button('Restore built-ins', () => guard(async () => { await PS.restoreBuiltIns(); await loadPresetList(); say('Built-in presets restored.'); }))), presetNote);
      fileInput.addEventListener('change', () => guard(async () => {
        const f = fileInput.files[0]; fileInput.value = ''; if (!f) return;
        if (f.size > 524288) throw new Error('File is too large (limit 512 KB).');
        const added = await PS.importJSON(await f.text()); await loadPresetList(); say('Imported ' + added.length + ' preset' + (added.length === 1 ? '' : 's') + '.');
      }));
    });

    // ---------- shell ----------
    const compactBtn = el('button', { type: 'button', class: 'so-iconbtn', 'aria-label': 'Toggle compact controls', title: 'Compact controls', text: '\u2195', onclick: () => ctrl.set('ui.compact', !S().ui.compact) });
    const closeBtn = el('button', { type: 'button', class: 'so-iconbtn', 'aria-label': 'Hide settings panel', title: 'Hide panel (the visualizer keeps running)', text: '\u00d7', onclick: () => ctrl.set('ui.panelVisible', false) });
    const header = el('div', { class: 'so-panel__header' }, el('span', { class: 'so-logo' }, U.logoSvg(16)), el('span', { class: 'so-title', text: 'SonicOverlay' }), page ? null : compactBtn, page ? null : closeBtn);
    const body = el('div', { class: 'so-panel__body' }, page ? null : statusBox);
    pending.forEach((s) => body.append(s));
    const panel = el('div', { class: 'so-panel' + (page ? ' so-panel--page' : ''), role: page ? 'region' : 'dialog', 'aria-label': 'SonicOverlay settings' }, header, body);
    function applyState() {
      panel.classList.toggle('so-compact', !!S().ui.compact);
      compactBtn.setAttribute('title', S().ui.compact ? 'Expand controls' : 'Compact controls');
      compactBtn.setAttribute('aria-label', S().ui.compact ? 'Expand controls' : 'Compact controls');
      for (const [id, b] of pickerBtns) { const on = id === S().visualizer; b.setAttribute('aria-checked', String(on)); b.classList.toggle('is-active', on); }
      const mode = S().color.mode, isGrad = mode === 'gradient', isRainbow = mode === 'rainbow';
      if (primColorRow) primColorRow.hidden = isRainbow;
      if (secColorRow) secColorRow.hidden = !isGrad;
      if (stopsHost) stopsHost.hidden = !isGrad;
      if (gradAngleRow) gradAngleRow.hidden = !isGrad;
      const bgOn = !!S().color.bgFill;
      if (bgColorRow) bgColorRow.hidden = !bgOn;
      if (bgOpRow) bgOpRow.hidden = !bgOn;
      const locked = !!S().layout.locked;
      alignCells.forEach((c) => { c.disabled = locked; });
      lay.disabled = locked;
      resetPosBtn.disabled = locked;
      if (presetSel && S().presetName && presetSel.value !== S().presetName) {
        if ([...presetSel.options].some((o) => o.value === S().presetName)) {
          presetSel.value = S().presetName;
          nameInput.value = S().presetName;
        }
      }
      if (metaLine) metaLine.hidden = !metaLine.textContent;
    }
    function refresh() {
      controls.forEach((c) => c.update()); dynamics.forEach((d) => d.update()); applyState(); if (!page) { panel.hidden = !S().ui.panelVisible; place(); }
    }

    // dragging (overlay mode)
    function place() {
      if (page) return;
      const W = window.innerWidth, Hh = window.innerHeight, pw = panel.offsetWidth || 340;
      let x = S().ui.panelX, y = S().ui.panelY;
      if (x < 0 || y < 0) { x = W - pw - 16; y = 16; }
      x = U.clamp(x, 0, Math.max(0, W - pw - 8)); y = U.clamp(y, 0, Math.max(0, Hh - 80));
      panel.style.left = x + 'px'; panel.style.top = y + 'px';
    }
    if (!page) {
      header.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button') || e.button !== 0) return;
        const r = panel.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
        const pw = panel.offsetWidth || 340;
        header.setPointerCapture(e.pointerId); header.classList.add('is-dragging');
        const move = (ev) => {
          panel.style.left = U.clamp(ev.clientX - dx, 0, Math.max(0, window.innerWidth - pw - 8)) + 'px';
          panel.style.top = U.clamp(ev.clientY - dy, 0, Math.max(0, window.innerHeight - 80)) + 'px';
        };
        const up = (ev) => {
          try { header.releasePointerCapture(ev.pointerId || e.pointerId); } catch (err) {}
          header.removeEventListener('pointermove', move);
          header.removeEventListener('pointerup', up);
          header.removeEventListener('pointercancel', up);
          header.classList.remove('is-dragging');
          ctrl.set('ui.panelX', parseInt(panel.style.left, 10));
          ctrl.set('ui.panelY', parseInt(panel.style.top, 10));
        };
        header.addEventListener('pointermove', move);
        header.addEventListener('pointerup', up);
        header.addEventListener('pointercancel', up);
      });
      panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); ctrl.set('ui.panelVisible', false); } });
      panel.addEventListener('keyup', (e) => e.stopPropagation());   // keep typing from reaching Spotify shortcuts
      panel.addEventListener('keypress', (e) => e.stopPropagation());
      panel.addEventListener('keydown', (e) => { if (e.key !== 'Escape') e.stopPropagation(); });
    }

    ctrl.subscribe((s, kind, path) => {
      if (kind === 'set') {
        if (path === 'ui.compact' || path === 'ui.panelVisible' || path === 'visualizer' || path === 'layout.locked' || path === 'color.mode' || path === 'color.bgFill' || path === 'meta.showArt' || path === 'presetName') {
          refresh();
        }
        return;
      }
      refresh();
    });
    loadPresetList().then(() => {});
    refresh();

    function setStatus(info) {
      const c = info.capture || {}; let cls = 'idle', title = 'Not capturing', hint = 'Click the SonicOverlay toolbar icon and press \u201cStart visualization\u201d, or press Alt+Shift+C.';
      if (c.status === 'starting') { cls = 'busy'; title = 'Starting\u2026'; hint = ''; }
      else if (c.status === 'capturing' && !c.thisTab) { cls = 'warn'; title = 'Capturing another Spotify tab'; hint = 'Stop it there, or start capture from this tab.'; }
      else if (c.status === 'capturing') {
        if (info.stale) { cls = 'warn'; title = 'No data from capture'; hint = SO.ERRORS.NO_DATA[1]; }
        else if (info.silent) { cls = 'warn'; title = 'Capturing \u2013 no sound'; hint = 'Press play in Spotify. The visualizer reacts to real audio only.'; }
        else { cls = 'live'; title = 'Live'; hint = ''; }
      } else if (c.status === 'error' && c.error) { cls = 'error'; title = c.error.message; hint = c.error.hint; }
      statusBox.dataset.state = cls;
      statusBox.querySelector('.so-status__title').textContent = title; statusBox.querySelector('.so-status__hint').textContent = hint;
      statusBox.querySelector('.so-status__hint').hidden = !hint;
      const m = info.meta || {};
      const metaText = m.available ? (m.title || 'Unknown track') + (m.artist ? ' \u2013 ' + m.artist : '') : 'Track info unavailable \u2013 the visualizer still works.';
      const art = info.artStatus === 'ok' ? 'Colors follow the cover art.' : info.artStatus === 'no-palette' ? 'Cover colors unavailable; using your gradient.' : '';
      statusBox.querySelector('.so-status__meta').textContent = metaText + (art ? ' ' + art : '');
      metaLine.textContent = metaText;
    }
    function setAccent(rgb) { if (rgb) panel.style.setProperty('--so-accent', 'rgb(' + rgb.map(Math.round).join(',') + ')'); }

    return { el: panel, refresh, place, setStatus, setAccent, destroy() { panel.remove(); } };
  }

  SO.SettingsPanel = {
    create,
    async bootOptionsPage() {
      const s = await SS.load(); const ctrl = SS.createController(s); ctrl.listenExternal();
      const p = create({ ctrl, mode: 'page', hooks: {} });
      document.getElementById('panel-root').append(p.el);
    }
  };
  if (typeof document !== 'undefined' && document.body && document.body.id === 'so-options') SO.SettingsPanel.bootOptionsPage();
})(typeof self !== 'undefined' ? self : this);
