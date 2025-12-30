# Stash VR Plugin

A lightweight Stash plugin that adds WebXR VR support for modern VR headsets (Quest via Link/AirLink, Oculus Rift, Index, etc.). It enables immersive viewing directly within the Stash video player.

## Features

- **VR Button** - Seamlessly integrated into the VideoJS control bar.
- **WebXR Native** - Built on modern WebXR APIs for broad hardware compatibility.
- **180° / 360° Support** - Designed for immersive video formats (currently optimized for 180° SBS).
- **Stereoscopic Rendering** - Full 3D support using Side-By-Side (SBS) video textures.
- **Zero Backend** - Runs entirely in the browser; no complex installation or Python scripts required.

## Installation

### Method 1: Add Source to StashApp (Recommended)

1. Go to **Settings > Plugins**.
2. Click **Sources** (top right) -> **Add Source**.
3. Enter the following details:
   - **Name**: stashVR
   - **URL**: `https://happykinkster.github.io/stash-buttplug/main/index.yml`
4. Click **Confirm**.
5. Go back to the **Available** plugins tab.
6. Install **stashVR**.


### Method 2: Manual Installation

1. **Locate Plugin Directory**: Find your Stash plugins directory (e.g., `C:\Users\<User>\.stash\plugins`).
2. **Copy Files**: Copy the `stashVR` folder into the `plugins` directory.
3. **Reload Plugins**: Go to Stash > Settings > System > Plugins and click "Reload Plugins".

## Usage

1. **Connect Headset**: Ensure your VR headset is connected to your PC (e.g., via Quest Link).
2. **Open Scene**: Play a video in Stash.
3. **Toggle VR**: Click the **🥽 VR** button in the video control bar.
4. **Immersive View**: Put on your headset. The video will be projected onto a hemispherical sphere with full head tracking.
5. **Exit**: Click the button again or take off the headset and end the session in your browser.

## Requirements

- **Browsers**: Chrome, Edge, or any Chromium-based browser with WebXR enabled.
- **Hardware**: Any VR headset supported by OpenXR.
- **Orientation**: This plugin currently optimizes for 180° SBS video.

## Troubleshooting

- **Button Persistent**: If the button doesn't appear, ensure "WebXR" is enabled in your browser flags (`chrome://flags/#webxr-runtime`). 
- **Double Vision**: Ensure your video is a Side-By-Side (SBS) format.
- **Black Screen**: Check the developer console (F12) for blocks on CDN loading (three.js is loaded from `cdn.jsdelivr.net`).

## Technical Details

The plugin operates by:
1. Dynamically importing **Three.js** from a CDN.
2. Hooking into the **VideoJS** player instance.
3. Creating a `WebGLRenderer` with XR support enabled.
4. Mapping the video element as a `VideoTexture` onto a `SphereGeometry`.
5. Splitting the texture for stereoscopic depth in SBS mode.

## License

MIT
