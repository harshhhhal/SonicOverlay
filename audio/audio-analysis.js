/* SonicOverlay - turns raw analyser frames into smoothed, normalised data for visualizers (content script). */
(function (root) {
  'use strict';
  const SO = (root.SO = root.SO || {});
  const N = 256, WN = 256, FMIN = 30, FMAX = 16000;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  function decode(str, buf) {
    const bin = atob(str);
    if (!buf || buf.length !== bin.length) buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return buf;
  }

  SO.FrameProcessor = class FrameProcessor {
    constructor() {
      this.spectrum = new Float32Array(N);   // smoothed, response-shaped, 0..1 (log-spaced 30 Hz .. 16 kHz)
      this.waveform = new Float32Array(WN);  // -1..1 (trigger-aligned)
      this.norm = new Float32Array(N);       // un-gained normalised target
      this.target = new Float32Array(N);
      this.tmp = new Float32Array(N);
      this.low = 0; this.mid = 0; this.high = 0; this.bass = 0; this.beat = 0; this.energy = 0;
      this.live = false; this.silentFor = 0; this.lastFrameAt = 0; this.frames = 0;
      this.rawF = null; this.rawT = null; this.rawSilent = false; this.fresh = false; this.sr = 48000; this.fft = 2048; this.K = 0;
      this.lo = new Float32Array(N); this.hi = new Float32Array(N); this.freqs = new Float32Array(N); this.mapKey = '';
      this.avgLow = 0; this.lastBeat = 0; this.gains = new Float32Array(N); this.gainKey = '';
    }

    ingest(msg, now) {
      this.rawF = decode(msg.f, this.rawF); this.rawT = decode(msg.t, this.rawT);
      this.sr = msg.sr; this.fft = msg.fft; this.K = this.rawF.length;
      let mx = 0; for (let i = 0; i < this.rawF.length; i++) if (this.rawF[i] > mx) mx = this.rawF[i];
      this.rawSilent = mx === 0;
      this.lastFrameAt = now; this.fresh = true; this.frames++;
    }

    rebuildMap() {
      const key = this.sr + '/' + this.fft + '/' + this.K;
      if (key === this.mapKey) return;
      this.mapKey = key;
      const binHz = this.sr / this.fft, fmax = Math.min(FMAX, this.K * binHz), ratio = fmax / FMIN;
      for (let i = 0; i < N; i++) {
        const f0 = FMIN * Math.pow(ratio, i / N), f1 = FMIN * Math.pow(ratio, (i + 1) / N);
        this.lo[i] = f0 / binHz; this.hi[i] = f1 / binHz; this.freqs[i] = Math.sqrt(f0 * f1);
      }
      this.gainKey = '';
    }

    rebuildGains(a) {
      const key = a.bassBoost + '/' + a.midResponse + '/' + a.highResponse + '/' + this.mapKey;
      if (key === this.gainKey) return;
      this.gainKey = key;
      const sm = (x, a0, a1) => clamp((x - a0) / (a1 - a0), 0, 1);
      for (let i = 0; i < N; i++) {
        const f = this.freqs[i], t1 = sm(f, 150, 350), t2 = sm(f, 3000, 5500);
        const low = a.bassBoost / 100, mid = a.midResponse / 100, high = a.highResponse / 100;
        this.gains[i] = (low * (1 - t1) + mid * t1 * (1 - t2) + high * t2) ;
      }
    }

    /** Advance one render frame. dt in seconds. */
    update(dt, a, now, reduced) {
      this.live = now - this.lastFrameAt < 700;
      const raw = this.rawF;
      if (this.live && raw && raw.length) {
        this.rebuildMap(); this.rebuildGains(a);
        if (this.fresh) { this.computeTargets(); this.computeWave(a); this.fresh = false; }
      } else { this.target.fill(0); this.norm.fill(0); }

      const sens = a.sensitivity / 100;
      const rise = clamp(1 - (a.smoothing / 100) * 0.9, 0.1, 1);
      const decay = clamp(a.decay + (reduced ? 20 : 0), 0, 100);
      const fall = Math.pow(0.8 + 0.195 * decay / 100, dt * 60);
      const riseK = 1 - Math.pow(1 - rise, dt * 60);
      let sum = 0, lowS = 0, lowN = 0, midS = 0, midN = 0, hiS = 0, hiN = 0;
      for (let i = 0; i < N; i++) {
        const v = clamp(this.target[i] * sens * this.gains[i], 0, 1);
        let p = this.spectrum[i];
        p = v > p ? p + (v - p) * riseK : Math.max(v, p * fall);
        this.spectrum[i] = p; sum += p;
        const f = this.freqs[i];
        if (f < 250) { lowS += p; lowN++; } else if (f < 4000) { midS += p; midN++; } else { hiS += p; hiN++; }
      }
      this.energy = sum / N;
      this.low = lowN ? lowS / lowN : 0; this.mid = midN ? midS / midN : 0; this.high = hiN ? hiS / hiN : 0;
      this.bass = clamp(this.low, 0, 1);

      // beat detection on the un-gained signal so sensitivity cannot fabricate beats
      let lr = 0, ln = 0;
      for (let i = 0; i < N; i++) if (this.freqs[i] < 250) { lr += this.norm[i]; ln++; }
      lr = ln ? lr / ln : 0;
      this.avgLow += (lr - this.avgLow) * (1 - Math.pow(0.96, dt * 60));
      if (this.live && lr > this.avgLow * 1.25 + 0.04 && lr > 0.25 && now - this.lastBeat > 180) { this.beat = 1; this.lastBeat = now; }
      this.beat *= Math.pow(0.9, dt * 60);
      if (this.beat < 0.002) this.beat = 0;

      if (this.live && this.rawSilent) this.silentFor += dt; else this.silentFor = 0;
    }

    computeTargets() {
      const raw = this.rawF, K = raw.length, t = this.tmp;
      for (let i = 0; i < N; i++) {
        const lo = this.lo[i], hi = this.hi[i];
        let v;
        if (hi - lo < 1) {
          const c = Math.min(K - 1, (lo + hi) / 2), b0 = Math.floor(c), fr = c - b0;
          v = raw[b0] * (1 - fr) + raw[Math.min(K - 1, b0 + 1)] * fr;
        } else {
          let s = 0, m = 0, n = 0;
          for (let b = Math.max(0, Math.ceil(lo)); b <= Math.min(K - 1, Math.floor(hi)); b++) { s += raw[b]; if (raw[b] > m) m = raw[b]; n++; }
          v = n ? 0.6 * (s / n) + 0.4 * m : 0;
        }
        let x = v / 255;
        x = Math.max(0, (x - 0.04) / 0.96);           // noise gate: silence stays flat
        x = Math.pow(x, 1.15) * (0.8 + 0.5 * (i / N)); // mild spectral tilt for high-frequency visibility
        t[i] = x;
      }
      for (let i = 0; i < N; i++) {                    // light spatial smoothing
        const a = t[Math.max(0, i - 1)], b = t[i], c = t[Math.min(N - 1, i + 1)];
        const x = clamp(0.25 * a + 0.5 * b + 0.25 * c, 0, 1);
        this.norm[i] = x; this.target[i] = x;
      }
    }

    computeWave(a) {
      const raw = this.rawT, L = raw.length;
      const win = Math.floor(L * 0.66);
      let off = 0;
      for (let i = 1; i < Math.floor(L * 0.34); i++) if (raw[i - 1] < 128 && raw[i] >= 128) { off = i; break; }
      const amp = a.amplitude / 100;
      for (let i = 0; i < WN; i++) {
        const p = off + (i * (win - 1)) / (WN - 1), b = Math.floor(p), fr = p - b;
        const v = ((raw[b] * (1 - fr) + raw[Math.min(L - 1, b + 1)] * fr) - 128) / 128;
        this.waveform[i] = clamp(v * amp, -1.5, 1.5);
      }
    }
  };
})(typeof self !== 'undefined' ? self : this);
