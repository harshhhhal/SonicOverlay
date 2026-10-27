/* SonicOverlay - offscreen document: owns the captured stream, AudioContext and AnalyserNode.
   Frames go straight to connected content-script ports; if no port is connected they are relayed via the service worker. */
(function () {
  'use strict';
  const MSG = SO.MSG;
  const ports = new Set();
  let timer = null, seq = 0, currentTab = null;

  const mgr = new SO.AudioManager({
    onEvent(event, error) { stopLoop(); post({ type: MSG.OFFSCREEN_EVENT, event, error }); }
  });

  function post(m) { try { chrome.runtime.sendMessage(m).catch(() => {}); } catch (e) { /* ignore */ } }

  function tick() {
    const fr = mgr.readFrame();
    if (!fr) return;
    fr.type = MSG.FRAME; fr.seq = ++seq;
    if (ports.size) { for (const p of ports) { try { p.postMessage(fr); } catch (e) { ports.delete(p); } } }
    else post(fr);
  }
  function startLoop() { stopLoop(); timer = setInterval(tick, 20); }  // ~50 Hz
  function stopLoop() { if (timer) clearInterval(timer); timer = null; }

  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== SO.PORT_FRAMES || port.sender.id !== chrome.runtime.id) return;
    ports.add(port);
    port.onDisconnect.addListener(() => { ports.delete(port); void chrome.runtime.lastError; });
  });

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || msg.target !== 'offscreen') return false;
    if (!SO.Validation.validateMessage(msg, sender)) { sendResponse({ ok: false, error: SO.makeError('UNSUPPORTED_API', 'invalid message') }); return false; }
    switch (msg.type) {
      case MSG.OFFSCREEN_START:
        currentTab = msg.tabId;
        mgr.start(msg.streamId, msg.fftSize).then(() => { startLoop(); sendResponse({ ok: true }); })
          .catch((e) => sendResponse({ ok: false, error: e && e.code ? e : SO.makeError('STREAM_UNAVAILABLE', e && e.message) }));
        return true;
      case MSG.OFFSCREEN_STOP:
        stopLoop(); mgr.stop().then(() => sendResponse({ ok: true })); return true;
      case MSG.OFFSCREEN_CONFIG:
        mgr.setFftSize(msg.fftSize); sendResponse({ ok: true }); return false;
      default: return false;
    }
  });
})();
