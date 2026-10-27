/* SonicOverlay - Spotify Web Player metadata reader. All selectors live in SO.SELECTORS (single place to fix if Spotify changes its DOM). */
(function (root) {
  'use strict';
  const SO = (root.SO = root.SO || {});

  SO.SELECTORS = {
    widget: ['[data-testid="now-playing-widget"]', 'footer [data-testid="now-playing-widget"]', '[data-testid="now-playing-bar"]', 'footer'],
    bar: ['[data-testid="now-playing-bar"]', 'footer'],
    title: ['[data-testid="context-item-link"]', '[data-testid="nowplaying-track-link"]', '[data-testid="context-item-info-title"] a', '.ellipsis-one-line a[href^="/track/"]'],
    artist: ['[data-testid="context-item-info-subtitles"]', '[data-testid="context-item-info-artist"]', '[data-testid="nowplaying-artist"]', 'footer [data-testid="context-item-info-subtitles"] a', 'a[href^="/artist/"]'],
    art: ['[data-testid="cover-art-image"]', '[data-testid="now-playing-widget"] img', 'footer img[src*="i.scdn.co"]', '[data-testid="track-image"] img'],
    position: ['[data-testid="playback-position"]'],
    duration: ['[data-testid="playback-duration"]']
  };

  const first = (list, rootEl) => { for (const s of list) { const e = (rootEl || document).querySelector(s); if (e) return e; } return null; };
  const text = (e) => (e && e.textContent ? e.textContent.trim() : '');
  function parseTime(t) {
    const p = String(t || '').trim().split(':').map(Number);
    if (!p.length || p.some((x) => !Number.isFinite(x))) return NaN;
    return p.reduce((a, b) => a * 60 + b, 0);
  }

  SO.SpotifyMeta = class SpotifyMeta {
    constructor(onChange) {
      this.onChange = onChange; this.current = { title: '', artist: '', album: null, artUrl: '', position: 0, duration: 0, available: false };
      this.observer = null; this.observed = null; this.timer = null; this.poll = null; this.progress = null; this.trackKey = '';
    }
    start() {
      this.read(true);
      this.poll = setInterval(() => { if (!this.observed || !this.observed.isConnected) this.bind(); }, 3000);
      this.bind();
    }
    stop() {
      if (this.observer) this.observer.disconnect();
      clearInterval(this.poll); clearTimeout(this.timer); clearInterval(this.progress);
      this.observer = null; this.observed = null;
    }
    bind() {
      const target = first(SO.SELECTORS.widget);
      if (!target || target === this.observed) { if (!target) this.read(false); return; }
      if (this.observer) this.observer.disconnect();
      this.observed = target;
      this.observer = new MutationObserver(() => { clearTimeout(this.timer); this.timer = setTimeout(() => this.read(false), 150); });
      this.observer.observe(target, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'href'], characterData: true });
      this.read(false);
    }
    /** Poll playback position only while the UI asks for it. */
    trackProgress(on) {
      clearInterval(this.progress); this.progress = null;
      if (on) this.progress = setInterval(() => this.readProgress(), 1000);
    }
    readProgress() {
      const pos = parseTime(text(first(SO.SELECTORS.position))), dur = parseTime(text(first(SO.SELECTORS.duration)));
      this.current.position = Number.isFinite(pos) ? pos : 0; this.current.duration = Number.isFinite(dur) ? dur : 0;
    }
    read(initial) {
      const S = SO.SELECTORS, w = first(S.widget) || document;
      const title = text(first(S.title, w)), artist = text(first(S.artist, w));
      const img = first(S.art, w), src = img ? (img.currentSrc || img.getAttribute('src') || '') : '';
      const link = first(S.title, w), href = link && link.getAttribute('href') || '';
      const next = Object.assign(this.current, {
        title, artist, artUrl: /^https:\/\/i\.scdn\.co\//.test(src) ? src : '',
        album: null, available: !!(title || artist)
      });
      this.readProgress();
      const key = title + '|' + artist + '|' + next.artUrl;
      if (key !== this.trackKey || initial) { this.trackKey = key; this.onChange(next); }
    }
  };
})(typeof self !== 'undefined' ? self : this);
