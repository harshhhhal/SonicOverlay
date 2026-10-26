# Changelog

All notable changes to SonicOverlay are documented in this file.

## [2.0.0] - 2026-10-27

### Added
- **12 New Audio Visualizers** (expanding catalog from 12 to 24):
  1. **Neon Oscilloscope (`neon-oscilloscope`)**: Crisp luminous trace rendered from actual trigger-aligned time-domain waveform (`f.waveform`), supporting single/dual/tri phase offsets, amplitude gain, and persistence ghosting trails stored in ring buffers.
  2. **Liquid Ribbon (`liquid-ribbon`)**: Flowing multi-layered curved ribbons whose wave crests and curvature are continuously modulated by resampled spectrum bands, beat energy, and audio-reactive tension.
  3. **Aurora Flow (`aurora-flow`)**: Ethereal cinematic curtains with soft vertical gradient fills, luminous top crests, and frequency-responsive vertical shimmer and undulation.
  4. **Frequency Mountain (`frequency-mountain`)**: Layered 2D mountain landscape with background, midground, and foreground terrain profiles mapped directly to audio spectrum harmonics.
  5. **Vortex Tunnel (`vortex-tunnel`)**: Perspective tunnel with selectable geometry (Circle, Triangle, Square, Hexagon, Octagon) that expands, rotates, and pulses to real bass energy and beat transients.
  6. **Starfield Drift (`starfield-drift`)**: Depth-based 3D starfield with deterministic seeded positions, speed warp, particle trail rendering, and an audio-reactive central warp aura.
  7. **Plasma Orbit (`plasma-orbit`)**: Interlocking tilted elliptical orbits with glowing harmonic nodes pulsing across bass, mid, and treble registers with connecting chords.
  8. **Concentric Pulse (`concentric-pulse`)**: Elegant concentric shockwave rings triggered on bass/beat transients that decay with natural exponential curves, complemented by precision radial tick markers.
  9. **Glitch Spectrum (`glitch-spectrum`)**: Digital segmented spectrum bars with beat-synchronized horizontal slice displacement, scan line raster overlay, and chromatic RGB shift.
  10. **Equalizer Matrix (`equalizer-matrix`)**: Hardware-inspired LED grid with rounded, square, or circle cells and hardware-style peak hold indicators.
  11. **Spectrum Ribbon (`spectrum-ribbon`)**: Continuous filled spectral surface with smooth Catmull-Rom curves and temporal history trail layers.
  12. **Orbiting Particles (`orbiting-particles`)**: Multi-ring orbital particle system with persistent particles initialized once in state, driven by real frequency band energies and rotation speeds.
- **Picker Glyphs**: Added static vector glyphs in `SO.H.icon` for all 12 new visualizer types in the visualizer picker UI.
- **Showcase Presets**: Added 4 new built-in presets (*Neon Cyberwave*, *Aurora Borealis*, *Cosmic Vortex*, and *Hardware Matrix*) while fully preserving all 12 original presets.
- **Test Suite Expansion**: Added automated unit tests covering all 24 visualizers, ensuring clean rendering under zero/quiet audio frames, peak loud audio frames, and reduced-motion mode.

### Fixed
- **UI Glitches & Style Clashes**:
  - Scoped CSS `mix-blend-mode` strictly to `#sonic-overlay-canvas` instead of the root container `#sonic-overlay-root`, preventing blend mode interference with settings panel controls and toasts.
  - Added visual grip icon (`::after`) to the resize handle in layout edit mode for immediate discoverability.
  - Added capture-phase `Escape` key listener on `document` to reliably exit layout edit mode.
  - Prevented drag and resize handle collision on small or corner widgets.
  - Fixed panel drag boundary clamp so the settings panel cannot be dragged completely off-screen.
  - Added pointer capture release and `pointercancel` cleanup to prevent stuck drag states.
  - Fixed color picker swatch borders in Chromium using `-webkit-color-swatch` styling.
  - Added custom slider thumb cursors and disabled states for range inputs.
- **Controls & Settings Synchronization**:
  - Fixed settings controller listener to react to `layout.locked`, `color.mode`, `color.bgFill`, and `presetName`.
  - Added layout lock verification before executing alignment grid or position reset actions.
  - Dynamically toggle visibility of gradient angle and color stop controls based on `color.mode`.
  - Fixed popup error alerts from disappearing prematurely during status refreshes.
  - Synchronized popup visualizer and preset `<select>` dropdowns when changed externally or via keyboard shortcuts.
- **Renderer Stability & Audio Helpers**:
  - Fixed opacity squaring calculation in `visualizers/frequency-curve.js`.
  - Fixed velocity double-scaling bug and clamped radius bounds in `visualizers/particle-field.js`.
  - Clamped inner radius `a0` in `visualizers/radial-spectrum.js` to prevent bar self-intersection.
  - Clamped peak indicator y positions in `visualizers/classic-spectrum.js` within canvas bounds.
  - Wrapped `visualizers/ambient-orbs.js` with `try/finally` and clamped radius against zero.
  - Counter-rotated track title and artist text in `visualizers/album-art-ring.js` to ensure text stays upright.
  - Explicitly reset shadow offsets and blur in `drawMeta` (`visualizers/common.js`).
  - Sorted custom gradient color stops by position before adding stops in `utils/color-utils.js`.
