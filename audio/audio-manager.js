/* SonicOverlay - tab audio capture + AnalyserNode (runs in the offscreen document). */
(function (root) {
  'use strict';
  const SO = (root.SO = root.SO || {});
  const MAX_HZ = 16000;

  function toB64(u8) {
    let s = ''; const CH = 0x2000;
    for (let i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
    return btoa(s);
  }

  SO.AudioManager = class AudioManager {
    constructor(hooks) { this.hooks = hooks || {}; this.ctx = null; this.stream = null; this.source = null; this.analyser = null; this.freq = null; this.time = null; this.running = false; }

    async start(streamId, fftSize) {
      await this.stop();
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof AudioContext === 'undefined') throw SO.makeError('UNSUPPORTED_API');
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } }, video: false });
      } catch (e) {
        const msg = String((e && e.message) || e);
        if (/active stream/i.test(msg)) throw SO.makeError('ALREADY_CAPTURED', msg);
        if (e && (e.name === 'NotAllowedError' || /permission|invoked/i.test(msg))) throw SO.makeError('PERMISSION_DENIED', msg);
        throw SO.makeError('STREAM_UNAVAILABLE', msg);
      }
      const track = this.stream.getAudioTracks()[0];
      if (!track) { this.cleanup(); throw SO.makeError('STREAM_UNAVAILABLE', 'No audio track in captured stream.'); }
      track.addEventListener('ended', () => { if (this.running) { this.cleanup(); this.hooks.onEvent && this.hooks.onEvent('ended', SO.makeError('STREAM_ENDED')); } });

      this.ctx = new AudioContext({ latencyHint: 'interactive' });
      this.ctx.onstatechange = () => {
        if (!this.ctx) return;
        if (this.ctx.state === 'closed' && this.running) { this.cleanup(); this.hooks.onEvent && this.hooks.onEvent('error', SO.makeError('CONTEXT_CLOSED')); }
        else if (this.ctx.state === 'suspended' && this.running) { this.ctx.resume().catch(() => this.hooks.onEvent && this.hooks.onEvent('suspended', SO.makeError('CONTEXT_SUSPENDED'))); }
      };
      this.source = this.ctx.createMediaStreamSource(this.stream);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.minDecibels = -88; this.analyser.maxDecibels = -18; this.analyser.smoothingTimeConstant = 0.3;
      this.setFftSize(fftSize);
      this.source.connect(this.analyser);
      this.source.connect(this.ctx.destination);   // route captured audio back out so Spotify stays audible
      if (this.ctx.state !== 'running') {
        try { await this.ctx.resume(); } catch (e) { /* checked below */ }
        if (this.ctx.state !== 'running') { this.cleanup(); throw SO.makeError('CONTEXT_SUSPENDED'); }
      }
      this.running = true;
    }

    setFftSize(n) {
      if (!this.analyser || !SO.FFT_SIZES.includes(n)) return;
      this.analyser.fftSize = n;
      this.freq = new Uint8Array(this.analyser.frequencyBinCount);
      this.time = new Uint8Array(n);
    }

    readFrame() {
      if (!this.running || !this.analyser) return null;
      this.analyser.getByteFrequencyData(this.freq);
      this.analyser.getByteTimeDomainData(this.time);
      const sr = this.ctx.sampleRate, fft = this.analyser.fftSize;
      const K = Math.min(this.freq.length, Math.ceil(MAX_HZ / (sr / fft)));
      const dec = Math.max(1, fft / 512), tl = Math.floor(fft / dec);
      const t = new Uint8Array(tl);
      for (let i = 0; i < tl; i++) t[i] = this.time[Math.floor(i * dec)];
      return { sr, fft, f: toB64(this.freq.subarray(0, K)), t: toB64(t) };
    }

    cleanup() {
      this.running = false;
      try { this.source && this.source.disconnect(); } catch (e) { /* ignore */ }
      try { this.analyser && this.analyser.disconnect(); } catch (e) { /* ignore */ }
      if (this.stream) this.stream.getTracks().forEach((t) => { try { t.stop(); } catch (e) { /* ignore */ } });
      const c = this.ctx; this.ctx = null; this.stream = null; this.source = null; this.analyser = null;
      if (c) { c.onstatechange = null; c.close().catch(() => {}); }
    }
    async stop() { this.cleanup(); }
  };
})(typeof self !== 'undefined' ? self : this);
