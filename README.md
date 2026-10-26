# SonicOverlay

Real-time audio visualizations drawn as a **transparent, click-through overlay** on top of Spotify Web Player (open.spotify.com). Spotify stays visible and fully usable underneath. Spectrum colors **follow the current track's album art** and fade smoothly when the song changes.

## Features
- **24 Distinct Visualizers:**
  - **Original 12:** Classic Spectrum, Radial Spectrum, Circular Waveform, Linear Waveform, Mirrored Spectrum, Frequency Curve, Dot Spectrum, Stacked Spectrum, Particle Field, Ambient Orbs, Album Art Ring, Minimal Equalizer.
  - **New 12:**
    - `neon-oscilloscope`: Crisp luminous oscilloscope trace with real time-domain waveform, multi-trace phase offsets, and persistence ghosting.
    - `liquid-ribbon`: Flowing layered ribbons with curvature and amplitude driven by spectrum bands and beat energy.
    - `aurora-flow`: Ethereal undulating aurora curtains with subtle luminous crests and frequency-responsive vertical shimmer.
    - `frequency-mountain`: Multi-layered 2D mountain landscape with depth fading and frequency band terrain profiles.
    - `vortex-tunnel`: 3D perspective geometric tunnel pulsing and expanding dynamically with bass and beat transients.
    - `starfield-drift`: Deterministic seeded 3D starfield with speed warp, particle trails, and central beat aura.
    - `plasma-orbit`: Interlocking tilted elliptical orbits with glowing harmonic nodes pulsing across frequency registers.
    - `concentric-pulse`: Elegant radiating bass shockwave rings with natural decay and precision radial tick markers.
    - `glitch-spectrum`: Digital spectrum with beat-triggered horizontal slice offsets, scan lines, and chromatic RGB shift.
    - `equalizer-matrix`: Polished hardware-inspired LED cell matrix with rounded/square/circle dot modes and peak hold indicators.
    - `spectrum-ribbon`: Continuous filled spectral ribbon surface with temporal history trails and smooth edge curves.
    - `orbiting-particles`: Persistent multi-ring orbital particle system with audio-reactive rotation speeds and dilation.
  - All visualizers react strictly to real captured audio data (FFT spectrum or time-domain waveform). No fake or random data is ever generated.
- **Album-art colors:** dominant colors are extracted from the cover (hue-bucketed, saturation-weighted) and blended into the gradient. *Color & appearance -> Match album art colors* sets the blend (0% = only your own colors).
- **Settings studio:** colors/gradients/rainbow/mono, glow, opacity, blend modes, drag/resize edit mode, alignment grid, predefined layouts, audio controls (sensitivity, smoothing, decay, bass/mid/high, FFT size, peak hold), effects, track title/artist/artwork text.
- **Presets:** 16 built-in presets (including showcase presets for new visualizers like *Neon Cyberwave*, *Aurora Borealis*, *Cosmic Vortex*, and *Hardware Matrix*), create / rename / duplicate / delete, export and import as validated JSON.
- **Shortcuts & Accessibility:** Full keyboard shortcuts, reduced-motion compliance, settings persisted in `chrome.storage.local`.

## Browser compatibility
Chrome or any Chromium browser (Edge, Brave, Vivaldi...) **version 116+** (needs `chrome.offscreen` and `chrome.runtime.getContexts`). Desktop only. Spotify Web Player only (not the desktop app).

## Install (unpacked, no build step)
1. Unzip `SonicOverlay.zip`.
2. Open `chrome://extensions` (Edge: `edge://extensions`) and enable **Developer mode**.
3. Click **Load unpacked** and choose the `SonicOverlay` folder (the one containing `manifest.json`).
4. Pin the extension to the toolbar (optional).

## Use
1. Open https://open.spotify.com/ and start playing something. If Spotify was already open, reload it once.
2. With the Spotify tab active, click the SonicOverlay toolbar icon and press **Start visualization** (or press **Alt+Shift+C**). Chrome requires this explicit user action to capture tab audio. Audio is routed back out so Spotify stays audible.
3. Open the settings panel from the popup (**Settings panel**) or press **Alt+Shift+S**. Drag its header to move it; the x hides it while the visualizer keeps running.
4. **Edit layout** (Alt+Shift+E): drag the "Drag to move" handle, resize from the corner handle, press **Done** or Esc. Only those handles take mouse input; the rest of the overlay stays click-through, and everything returns to click-through the moment you leave edit mode.
5. Stop with **Stop visualization**. All audio resources are released.

## Presets
*Settings panel -> Presets*: choose to load; type a name and **Save**, **Rename**, **Duplicate**, **Delete** (click twice to confirm). **Export** downloads `sonicoverlay-presets.json`. **Import** validates the file (format, size, names, forbidden keys) and clamps every value; malformed or unsafe files are rejected with a message. **Restore built-ins** re-adds the 12 defaults. The full manager is also on the extension's options page.

## Keyboard shortcuts
| Action | Default |
|---|---|
| Show / hide overlay | Alt+Shift+V |
| Show / hide settings panel | Alt+Shift+S |
| Toggle edit mode | Alt+Shift+E |
| Start / stop capture | Alt+Shift+C |

Customize at `chrome://extensions/shortcuts`. The popup offers the same actions if a shortcut is unavailable. No page key listeners are installed, so Spotify's own shortcuts are untouched.

## Permissions (and why)
| Permission | Reason |
|---|---|
| `tabCapture` | Capture the Spotify tab's audio, only after you press Start. |
| `activeTab` | Lets Chrome grant capture for the tab you invoked the extension on. |
| `offscreen` | Hosts the Web Audio analyzer (service workers have no audio APIs). |
| `storage` | Saves settings and presets locally. |
| `https://open.spotify.com/*` | Injects the overlay and reads the visible track title, artist and cover. |
| `https://i.scdn.co/*` | Fallback download of the cover *image only* (via the service worker) if the page cannot read the cover's pixels for color extraction. |

No history, cookies, passwords, accounts, tokens or remote code. No Spotify API or credentials are used.

## Architecture
```
popup (user gesture) -> tabCapture.getMediaStreamId -> service worker -> offscreen document
offscreen: getUserMedia(tab) -> AudioContext -> source -> AnalyserNode
                                          \-> destination (audio stays audible)
offscreen --(runtime port, ~50 Hz, base64 bytes; falls back to SW relay)--> content script
content script: FrameProcessor (log-spaced bands, smoothing, beat) -> renderer registry -> canvas
```
- `content/spotify-meta.js` holds all Spotify DOM selectors in one object (`SO.SELECTORS`); if Spotify changes its markup, metadata degrades gracefully and the visualizer keeps working.
- `visualizers/` has one file per renderer plus `renderer-manager.js` (registry, layout transform, effects) and `common.js` (shared drawing helpers).

## Troubleshooting
| Symptom | Fix |
|---|---|
| "Chrome did not grant tab audio capture" | Click the toolbar icon *while the Spotify tab is active*, then Start. Don't start from a background tab. |
| "This tab is already being captured" | Another extension/recorder holds the tab. Stop it and reload Spotify. |
| Capturing but nothing moves | Spotify is paused or silent. Press play. The panel shows "Capturing - no sound". |
| Overlay missing after install | Reload the Spotify tab (content scripts inject on page load). |
| "Extension was reloaded" toast | Reload the Spotify tab. |
| Colors don't follow the cover | Check *Match album art colors* > 0%. If the panel says cover colors are unavailable, Spotify's CDN blocked both read paths; your gradient is used instead. |
| Track text missing | Spotify changed its markup; update `SO.SELECTORS`. |

## Known limitations
- Chrome requires a user gesture to start tab capture; it cannot auto-start on page load.
- Only one capture per tab; DRM/protected-media behavior varies by browser and is never bypassed.
- Fullscreen: the overlay follows document fullscreen of regular elements, not `<video>` elements.
- Blend modes, blur and heavy glow cost GPU time on large canvases; lower glow radius for weak machines.

## Package
```
cd <parent of SonicOverlay>
zip -r SonicOverlay.zip SonicOverlay -x "*/.DS_Store"
```
Run the bundled logic tests with `node tests/unit.test.js && node tests/service-worker.test.js`.

## License
MIT
