/* SonicOverlay - Manifest V3 service worker: capture lifecycle, commands, relay, image fallback. */
importScripts('../utils/message-types.js', '../utils/validation.js');

const MSG = SO.MSG;
const STATE_KEY = 'so.capture';
const OFFSCREEN_URL = 'background/offscreen.html';
let state = { status: 'idle', error: null, tabId: null };
let loaded = null;

function loadState() {
  if (!loaded) {
    loaded = chrome.storage.session.get(STATE_KEY).then(async (r) => {
      if (r[STATE_KEY]) state = r[STATE_KEY];
      if (state.status === 'capturing' || state.status === 'starting') {
        const ctxs = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] }).catch(() => []);
        if (!ctxs.length) state = { status: 'idle', error: null, tabId: null };
      }
    }).catch(() => {});
  }
  return loaded;
}

async function setState(status, tabId, error) {
  state = { status, tabId: tabId === undefined ? state.tabId : tabId, error: error || null };
  try { await chrome.storage.session.set({ [STATE_KEY]: state }); } catch (e) { /* ignore */ }
  const m = { type: MSG.CAPTURE_STATUS, status: state.status, error: state.error, tabId: state.tabId };
  chrome.runtime.sendMessage(m).catch(() => {});
  try {
    const tabs = await chrome.tabs.query({ url: 'https://open.spotify.com/*' });
    for (const t of tabs) chrome.tabs.sendMessage(t.id, Object.assign({}, m, { thisTab: t.id === state.tabId })).catch(() => {});
  } catch (e) { /* ignore */ }
}

async function hasOffscreen() {
  const ctxs = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  return ctxs.length > 0;
}
async function ensureOffscreen() {
  if (!chrome.offscreen) throw new Error('chrome.offscreen unavailable');
  if (await hasOffscreen()) return;
  await chrome.offscreen.createDocument({ url: OFFSCREEN_URL, reasons: ['USER_MEDIA'], justification: 'Analyze audio captured from the Spotify tab to drive the visualizer.' });
}
async function closeOffscreen() { try { if (await hasOffscreen()) await chrome.offscreen.closeDocument(); } catch (e) { /* ignore */ } }

async function readFftSize() {
  try {
    const r = await chrome.storage.local.get('so.settings');
    const n = r['so.settings'] && r['so.settings'].audio && r['so.settings'].audio.fftSize;
    return SO.FFT_SIZES.includes(n) ? n : 2048;
  } catch (e) { return 2048; }
}

async function startCapture(tabId, streamId) {
  await loadState();
  let tab = null;
  try { tab = await chrome.tabs.get(tabId); } catch (e) { /* ignore */ }
  if (!tab || !SO.isSpotifyUrl(tab.url)) { await setState('error', tabId, SO.makeError('NOT_SPOTIFY')); return { ok: false, error: state.error }; }
  if (state.status === 'capturing' || state.status === 'starting') await stopCapture(true);
  await setState('starting', tabId);
  try { await ensureOffscreen(); } catch (e) { await setState('error', tabId, SO.makeError('OFFSCREEN_UNAVAILABLE', e.message)); return { ok: false, error: state.error }; }
  let res;
  try { res = await chrome.runtime.sendMessage({ type: MSG.OFFSCREEN_START, target: 'offscreen', streamId, tabId, fftSize: await readFftSize() }); }
  catch (e) { res = { ok: false, error: SO.makeError('OFFSCREEN_UNAVAILABLE', e.message) }; }
  if (!res || !res.ok) {
    await closeOffscreen();
    await setState('error', tabId, (res && res.error) || SO.makeError('STREAM_UNAVAILABLE'));
    return { ok: false, error: state.error };
  }
  await setState('capturing', tabId);
  return { ok: true };
}

async function stopCapture(silent, error) {
  try { if (await hasOffscreen()) await chrome.runtime.sendMessage({ type: MSG.OFFSCREEN_STOP, target: 'offscreen' }).catch(() => {}); } catch (e) { /* ignore */ }
  await closeOffscreen();
  if (!silent) await setState(error ? 'error' : 'idle', null, error || null);
}

async function activeSpotifyTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab && SO.isSpotifyUrl(tab.url) ? tab : null;
}

function toB64(buf) {
  const u8 = new Uint8Array(buf); let s = ''; const CH = 0x8000;
  for (let i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
  return btoa(s);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.target === 'offscreen') return false;
  if (!SO.Validation.validateMessage(msg, sender)) return false;
  const fromTab = sender.tab ? sender.tab.id : null;

  switch (msg.type) {
    case MSG.FRAME:
      if (state.tabId != null && state.status === 'capturing') chrome.tabs.sendMessage(state.tabId, msg).catch(() => {});
      else loadState().then(() => { if (state.tabId != null) chrome.tabs.sendMessage(state.tabId, msg).catch(() => {}); });
      return false;
    case MSG.CAPTURE_GET_STATUS:
      loadState().then(() => sendResponse({ ok: true, status: state.status, error: state.error, tabId: state.tabId, thisTab: fromTab !== null && fromTab === state.tabId }));
      return true;
    case MSG.CAPTURE_START:
      startCapture(msg.tabId, msg.streamId).then(sendResponse); return true;
    case MSG.CAPTURE_STOP:
      loadState().then(() => stopCapture(false)).then(() => sendResponse({ ok: true })); return true;
    case MSG.OFFSCREEN_EVENT:
      loadState().then(async () => {
        await closeOffscreen();
        await setState('error', state.tabId, msg.error || SO.makeError('STREAM_ENDED'));
      }); return false;
    case MSG.OFFSCREEN_CONFIG:
      loadState().then(() => { if (state.status === 'capturing') chrome.runtime.sendMessage({ type: MSG.OFFSCREEN_CONFIG, target: 'offscreen', fftSize: msg.fftSize }).catch(() => {}); });
      return false;
    case MSG.FETCH_IMAGE:
      if (fromTab === null) { sendResponse({ ok: false }); return false; }
      fetch(msg.url, { credentials: 'omit' }).then(async (r) => {
        const type = r.headers.get('content-type') || '';
        if (!r.ok || !/^image\/(jpeg|png|webp)/.test(type)) throw new Error('bad response');
        const buf = await r.arrayBuffer();
        if (buf.byteLength > 2.5 * 1024 * 1024) throw new Error('too large');
        sendResponse({ ok: true, dataUrl: 'data:' + type.split(';')[0] + ';base64,' + toB64(buf) });
      }).catch((e) => sendResponse({ ok: false, error: String(e && e.message) }));
      return true;
    default: return false;
  }
});

chrome.commands.onCommand.addListener(async (command, tab) => {
  try {
    await loadState();
    tab = tab && SO.isSpotifyUrl(tab.url) ? tab : await activeSpotifyTab();
    if (!tab) return;
    if (command === 'toggle-capture') {
      if (state.status === 'capturing' || state.status === 'starting') { await stopCapture(false); return; }
      let streamId;
      try { streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id }); }
      catch (e) { await setState('error', tab.id, SO.makeError('PERMISSION_DENIED', e.message)); return; }
      await startCapture(tab.id, streamId);
    } else if (SO.COMMANDS.includes(command)) {
      chrome.tabs.sendMessage(tab.id, { type: MSG.OVERLAY_COMMAND, command }).catch(() => {});
    }
  } catch (e) { console.warn('[SonicOverlay] command failed', e); }
});

chrome.tabs.onRemoved.addListener(async (id) => {
  await loadState();
  if (id === state.tabId && (state.status === 'capturing' || state.status === 'starting')) { await stopCapture(true); await setState('idle', null, null); }
});
chrome.tabs.onUpdated.addListener(async (id, info) => {
  if (!info.url) return;
  await loadState();
  if (id === state.tabId && state.status === 'capturing' && !SO.isSpotifyUrl(info.url)) { await stopCapture(true); await setState('error', null, SO.makeError('TAB_NAVIGATED')); }
});
