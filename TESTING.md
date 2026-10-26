# Testing Notes & Quality Assurance Report

## Automated Test Results

### 1. Unit Tests (`node tests/unit.test.js`)
- **Status:** PASSED (92 passed, 0 failed)
- **Scope covered:**
  - Color palette extraction and art-driven gradient weighting.
  - Manifest message validation and audio parameter bounds.
  - Settings sanitization, defaults, and controller subscriptions (including `layout.locked`, `color.mode`, etc.).
  - Preset store validation, export/import round-trip, prototype pollution defense, and duplicate/rename/delete lifecycle for all 16 built-in presets.
  - Audio `FrameProcessor` analysis (bass/treble separation, silence gating, sensitivity decay, stale frame detection).
  - All **24 visualizers** loaded into registry and verified against schema (`id`, `name`, `layout`, `render`).
  - Rendering resilience tested across all 24 visualizers under:
    - Zero / quiet audio frames (`f.energy = 0`, `f.beat = 0`, `f.live = false`).
    - Peak loud audio frames (`f.energy = 0.95`, `f.beat = 1.0`, `f.live = true`).
    - Reduced motion mode (`rm = true`).

### 2. Service Worker Tests (`node tests/service-worker.test.js`)
- **Status:** PASSED (17 passed, 0 failed)
- **Scope covered:**
  - Audio capture state machine transitions.
  - Tab lifecycle, permission handling, and offscreen audio analyzer coordination.
  - Stream routing and cleanup.

### 3. Syntax Verification (`node --check`)
- **Status:** PASSED (0 syntax errors across all `.js` files).

### 4. Manifest V3 Integrity Check
- **Status:** PASSED
- `manifest.json` parsed as valid JSON.
- Every content script, CSS file, and web accessible resource exists on disk and is referenced in dependency-safe order.

---

## Manual Verification Checklist (Spotify Web Player)

For testing on `https://open.spotify.com/` in Chrome / Chromium:

1. **Installation:**
   - Navigate to `chrome://extensions`.
   - Enable **Developer mode**.
   - Click **Load unpacked** and select the SonicOverlay root directory.
   - Verify extension loads with no errors or warnings.

2. **Audio Capture Activation:**
   - Open `https://open.spotify.com/` and begin playing any track.
   - Click the SonicOverlay extension icon in the toolbar.
   - Press **Start visualization** (or `Alt+Shift+C`). Verify audio remains audible and tab capture begins immediately.

3. **Visualizer Selection & Rendering (All 24):**
   - Open settings panel (`Alt+Shift+S`) or use popup dropdown.
   - Test each of the 12 original visualizers:
     - Classic Spectrum, Radial Spectrum, Circular Waveform, Linear Waveform, Mirrored Spectrum, Frequency Curve, Dot Spectrum, Stacked Spectrum, Particle Field, Ambient Orbs, Album Art Ring, Minimal Equalizer.
   - Test each of the 12 new visualizers:
     - **Neon Oscilloscope:** Verify waveform curvature, phase shifts, and persistence fading.
     - **Liquid Ribbon:** Verify flowing wave crests modulated by beat and spectrum.
     - **Aurora Flow:** Verify soft vertical curtains and top edge shimmer.
     - **Frequency Mountain:** Verify 2D depth layers responsive to low/mid/high registers.
     - **Vortex Tunnel:** Verify perspective ring expansion on bass beats and polygon shape selection.
     - **Starfield Drift:** Verify smooth star movement, beat bursts, and lack of random flicker.
     - **Plasma Orbit:** Verify elliptical orbital motion and harmonic node pulsing.
     - **Concentric Pulse:** Verify expanding bass shockwaves and radial tick marks.
     - **Glitch Spectrum:** Verify beat-driven horizontal slice displacement and CRT scanlines.
     - **Equalizer Matrix:** Verify LED cell grid layouts and peak hold indicators.
     - **Spectrum Ribbon:** Verify flowing surface contours and history layers.
     - **Orbiting Particles:** Verify stable multi-band particle orbits and reactive dilation.

4. **Layout & Edit Mode:**
   - Press `Alt+Shift+E` to enter edit mode. Verify drag and resize handles appear with distinct styling.
   - Move and resize visualizer. Test that canvas remains click-through outside handles.
   - Press `Escape` or **Done** to exit edit mode.

5. **Color & Album Art Matching:**
   - Play tracks with distinct album artwork (e.g., vibrant versus dark/neutral covers).
   - Test *Match album art colors* slider (0% to 100%) and verify smooth color transitions.
   - Test solid, gradient, rainbow, and mono modes.

6. **Presets:**
   - Select built-in presets: *Cyberpunk Neon*, *Neon Cyberwave*, *Aurora Borealis*, *Cosmic Vortex*, *Hardware Matrix*.
   - Verify layout, color, and visualizer settings load instantaneously.
   - Test export and import functionality.
