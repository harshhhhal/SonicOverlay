/* SonicOverlay - shared constants: message types, status values, error catalogue. */
(function (root) {
  'use strict';
  const SO = (root.SO = root.SO || {});

  SO.MSG = Object.freeze({
    CAPTURE_START: 'so/capture/start',
    CAPTURE_STOP: 'so/capture/stop',
    CAPTURE_GET_STATUS: 'so/capture/get-status',
    CAPTURE_STATUS: 'so/capture/status',
    OFFSCREEN_START: 'so/offscreen/start',
    OFFSCREEN_STOP: 'so/offscreen/stop',
    OFFSCREEN_CONFIG: 'so/offscreen/config',
    OFFSCREEN_EVENT: 'so/offscreen/event',
    FRAME: 'so/frame',
    OVERLAY_COMMAND: 'so/overlay/command',
    OVERLAY_GET_STATE: 'so/overlay/get-state',
    FETCH_IMAGE: 'so/fetch-image'
  });

  SO.PORT_FRAMES = 'so-frames';
  SO.COMMANDS = Object.freeze(['toggle-overlay', 'toggle-panel', 'toggle-edit']);
  SO.STATUS = Object.freeze({ IDLE: 'idle', STARTING: 'starting', CAPTURING: 'capturing', ERROR: 'error' });
  SO.FFT_SIZES = Object.freeze([512, 1024, 2048, 4096, 8192]);

  const E = {
    PERMISSION_DENIED: ['Chrome did not grant tab audio capture.',
      'Click the SonicOverlay toolbar icon while the Spotify tab is active, then press "Start visualization". Capture cannot start from a background tab.'],
    STREAM_UNAVAILABLE: ['The tab audio stream could not be opened.',
      'Make sure Spotify is the active tab, then try again. Reload the Spotify tab if the problem persists.'],
    ALREADY_CAPTURED: ['This tab is already being captured.',
      'Another extension or recorder is capturing this tab. Stop it, reload Spotify and try again.'],
    CONTEXT_SUSPENDED: ['The audio engine is suspended.',
      'Click the toolbar icon and press "Start visualization" again to resume it.'],
    CONTEXT_CLOSED: ['The audio engine was closed.', 'Press "Start visualization" to restart capture.'],
    STREAM_ENDED: ['The audio stream ended.', 'Capture stops when the tab navigates away or Chrome revokes it. Press "Start visualization" to restart.'],
    TAB_NAVIGATED: ['The Spotify tab navigated away from open.spotify.com.', 'Return to open.spotify.com and start visualization again.'],
    TAB_CLOSED: ['The captured Spotify tab was closed.', 'Open Spotify Web Player and start visualization again.'],
    OFFSCREEN_UNAVAILABLE: ['The background audio document is unavailable.',
      'Reload the extension from chrome://extensions and try again. Chrome 116 or newer is required.'],
    UNSUPPORTED_API: ['This browser does not support the required capture APIs.', 'Use a recent Chrome, Edge or other Chromium browser (version 116+).'],
    NOT_SPOTIFY: ['The active tab is not Spotify Web Player.', 'Open https://open.spotify.com/ in the active tab, then try again.'],
    CONTEXT_INVALIDATED: ['The extension was reloaded or updated.', 'Reload this Spotify tab to reconnect the overlay.'],
    NO_DATA: ['Capture is running but no audio data is arriving.', 'Stop and start visualization again. If Spotify is paused, press play.']
  };
  SO.ERRORS = E;
  SO.makeError = function (code, detail) {
    const e = E[code] || ['Unexpected error.', 'Try stopping and starting visualization again.'];
    return { code: E[code] ? code : 'UNKNOWN', message: e[0], hint: e[1], detail: detail ? String(detail).slice(0, 300) : undefined };
  };

  SO.isSpotifyUrl = function (u) { return typeof u === 'string' && /^https:\/\/open\.spotify\.com(\/|$|\?|#)/.test(u); };
})(typeof self !== 'undefined' ? self : this);
