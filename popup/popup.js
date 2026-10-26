/* SonicOverlay - toolbar popup: user-initiated capture start/stop and quick controls. */
(async function () {
  'use strict';
  const MSG = SO.MSG, U = SO.Util, SS = SO.SettingsStore, PS = SO.PresetStore;
  const $ = (id) => document.getElementById(id);
  $('logo').append(U.logoSvg(18));

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const onSpotify = !!(tab && SO.isSpotifyUrl(tab.url));
  let cap = { status: 'idle', error: null, thisTab: false };

  let localError = null;
  function showError(e) {
    localError = e;
    $('error').hidden = !e;
    if (e) { $('errTitle').textContent = e.message; $('errHint').textContent = e.hint || ''; }
  }
  function render() {
    const capturing = cap.status === 'capturing' || cap.status === 'starting';
    if (capturing) localError = null;
    $('pill').dataset.state = cap.status;
    $('pillText').textContent = { idle: 'Not capturing', starting: 'Starting\u2026', capturing: cap.thisTab ? 'Live' : 'Capturing other tab', error: 'Error' }[cap.status] || cap.status;
    const btn = $('capture');
    btn.textContent = capturing ? 'Stop visualization' : 'Start visualization'; btn.dataset.mode = capturing ? 'stop' : 'start';
    btn.disabled = !onSpotify && !capturing;
    $('hint').textContent = capturing ? 'Audio from the Spotify tab is being analyzed. Playback stays audible.' : 'Starts capturing this tab\u2019s audio. Spotify keeps playing normally.';
    $('notice').hidden = onSpotify;
    $('editBtn').disabled = !onSpotify;
    $('panelBtn').disabled = !onSpotify;
    const err = localError || (cap.status === 'error' ? cap.error : null);
    showError(err);
  }

  async function refreshStatus() {
    const r = await U.send({ type: MSG.CAPTURE_GET_STATUS });
    if (r && r.ok) cap = { status: r.status, error: r.error, thisTab: !!tab && r.tabId === tab.id };
    render();
  }
  chrome.runtime.onMessage.addListener((m) => {
    if (m && m.type === MSG.CAPTURE_STATUS) { cap = { status: m.status, error: m.error || null, thisTab: !!tab && m.tabId === tab.id }; render(); }
  });

  $('capture').addEventListener('click', async () => {
    const btn = $('capture'); btn.disabled = true;
    try {
      if (cap.status === 'capturing' || cap.status === 'starting') { await U.send({ type: MSG.CAPTURE_STOP }); return; }
      if (!onSpotify) { showError(SO.makeError('NOT_SPOTIFY')); return; }
      let streamId;
      try { streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id }); }
      catch (e) {
        const err = SO.makeError(/invoked|permission/i.test(e.message) ? 'PERMISSION_DENIED' : 'STREAM_UNAVAILABLE', e.message);
        cap = { status: 'error', error: err, thisTab: false };
        showError(err);
        return;
      }
      const r = await U.send({ type: MSG.CAPTURE_START, tabId: tab.id, streamId });
      if (r && r.ok === false && r.error) {
        cap = { status: 'error', error: r.error, thisTab: false };
        showError(r.error);
      }
    } finally { await refreshStatus(); }
  });

  // quick controls
  const s = await SS.load();
  $('enabled').checked = s.enabled;
  $('enabled').addEventListener('change', (e) => SS.update((x) => { x.enabled = e.target.checked; }));
  for (const v of SO.VIZ_LIST) $('viz').append(U.el('option', { value: v.id, text: v.name }));
  $('viz').value = s.visualizer;
  $('viz').addEventListener('change', (e) => SS.update((x) => {
    x.visualizer = e.target.value; x.presetName = 'Custom';
    $('preset').value = 'Custom';
    const L = SO.LAYOUTS[(SO.VIZ_LIST.find((v) => v.id === x.visualizer) || {}).layout];
    if (L && !x.layout.locked) Object.assign(x.layout, { x: L.x, y: L.y, width: L.width, height: L.height });
  }));
  async function loadPresets(selected) {
    const names = await PS.list(); $('preset').replaceChildren(...names.map((n) => U.el('option', { value: n, text: n })));
    const want = selected || s.presetName;
    $('preset').value = names.includes(want) ? want : names[0];
  }
  await loadPresets();
  $('preset').addEventListener('change', async (e) => {
    const name = e.target.value, snap = await PS.get(name); if (!snap) return;
    if (snap.visualizer) $('viz').value = snap.visualizer;
    await SS.update((x) => { Object.assign(x, PS.applyTo(x, snap, name)); });
  });

  if (chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener(async (ch, area) => {
      if (area !== 'local' || !ch[SS.KEY] || !ch[SS.KEY].newValue) return;
      const cur = ch[SS.KEY].newValue;
      $('enabled').checked = !!cur.enabled;
      $('viz').value = cur.visualizer;
      await loadPresets(cur.presetName);
    });
  }

  $('panelBtn').addEventListener('click', () => SS.update((x) => { x.ui.panelVisible = !x.ui.panelVisible; }));
  $('editBtn').addEventListener('click', async () => {
    const r = await new Promise((res) => chrome.tabs.sendMessage(tab.id, { type: MSG.OVERLAY_COMMAND, command: 'toggle-edit' }, (x) => res(chrome.runtime.lastError ? null : x || true)));
    if (!r) showError({ message: 'The overlay is not loaded in this tab.', hint: 'Reload the Spotify tab and try again.' }); else window.close();
  });
  $('moreBtn').addEventListener('click', () => { chrome.runtime.openOptionsPage(); window.close(); });
  $('shortcutsBtn').addEventListener('click', () => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }));
  $('openSpotify').addEventListener('click', () => { chrome.tabs.create({ url: 'https://open.spotify.com/' }); window.close(); });

  render(); await refreshStatus();
})();
