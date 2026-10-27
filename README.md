# SonicOverlay

**A real-time, click-through audio visualizer for Spotify Web Player.**

SonicOverlay draws responsive visuals over [open.spotify.com](https://open.spotify.com) while leaving Spotify usable underneath. It captures the active tab only after you start it, then uses the track's cover art to tint the visualizer.

## Highlights

- 24 audio-reactive visualizers, from clean spectrum bars to vortexes, auroras, ribbons, and particles
- Album-art color matching with smooth transitions between tracks
- Click-through overlay, plus drag-and-resize layout editing when needed
- Live controls for color, glow, opacity, blend mode, sensitivity, smoothing, EQ gains, FFT size, and peak hold
- 16 built-in presets, with custom preset import and export
- Keyboard shortcuts and reduced-motion support
- All settings and presets stored locally in Chrome

## Requirements

- Chrome 116+ or another Chromium browser such as Edge, Brave, or Vivaldi
- Desktop Spotify Web Player at `open.spotify.com`

SonicOverlay does not work with the Spotify desktop app.

## Install

1. Download or clone this repository.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Enable **Developer mode**.
4. Select **Load unpacked** and choose the `SonicOverlay` directory—the folder containing `manifest.json`.
5. Pin SonicOverlay to the browser toolbar if desired.

## Use

1. Open Spotify Web Player and begin playing music. Reload the tab once if it was already open during installation.
2. With the Spotify tab active, open the SonicOverlay toolbar popup and select **Start visualization**.
3. Use **Settings panel** to choose a visualizer, customize its appearance, or adjust its placement.

Chrome requires the explicit Start action before it allows tab-audio capture. Audio continues playing through your speakers while SonicOverlay analyzes it.

## Keyboard shortcuts

| Action | Default shortcut |
| --- | --- |
| Show or hide overlay | `Alt` + `Shift` + `V` |
| Show or hide settings | `Alt` + `Shift` + `S` |
| Toggle layout edit mode | `Alt` + `Shift` + `E` |
| Start or stop capture | `Alt` + `Shift` + `C` |

Change shortcuts at `chrome://extensions/shortcuts`.

## Privacy and permissions

SonicOverlay does not use a Spotify API, account login, remote code, or cloud sync. It does not read browsing history, cookies, passwords, or tokens.

| Permission | Why it is needed |
| --- | --- |
| `tabCapture` | Reads audio from the active Spotify tab after you press Start. |
| `activeTab` | Lets Chrome grant access to the active tab. |
| `offscreen` | Runs the Web Audio analyzer outside the service worker. |
| `storage` | Saves visualizer settings and presets locally. |
| `open.spotify.com` | Adds the overlay and reads visible song metadata and cover art. |
| `i.scdn.co` | Retrieves cover art only when needed for color extraction. |

## Troubleshooting

| Issue | Try this |
| --- | --- |
| Overlay does not appear | Reload the Spotify tab after installing or reloading the extension. |
| Visualizer is not moving | Confirm Spotify is playing and the tab is not muted. |
| Chrome did not grant capture | Open the extension popup while Spotify is the active tab, then start again. |
| Colors do not follow the cover | Ensure **Match album art colors** is above 0%. |
| A shortcut does not work | Reassign it at `chrome://extensions/shortcuts`. |

## Project layout

```text
SonicOverlay/
├── audio/          Audio capture and analysis
├── background/     Extension service worker
├── content/        Spotify integration and overlay styles
├── popup/          Toolbar popup
├── settings/       On-page settings experience
├── storage/        Local settings and preset storage
├── visualizers/    Renderer registry and visualizer implementations
└── tests/          Unit and service-worker tests
```

## Development

There is no build step. Load the `SonicOverlay` directory as an unpacked extension after making changes, then reload the Spotify tab.

Run the included tests from the extension directory:

```bash
node tests/unit.test.js
node tests/service-worker.test.js
```

## Notes

- Only one capture can run for a tab at a time.
- Protected-media behavior varies by browser and is not bypassed.
- Heavy blur, glow, and blend modes can affect performance on lower-powered devices.
- SonicOverlay is an independent project and is not affiliated with or endorsed by Spotify.
