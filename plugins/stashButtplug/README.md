# Stash-Buttplug Plugin

This plugin connects StashApp to Buttplug.io (Intiface) to control devices like the Kiiroo Keon, vibrators, and rotators using Funscripts synced with your scenes. This version is built using high-precision logic ported from the Stash core.

## Features

- **High Precision**: Uses the `FunscriptPlayer` logic from Stash core for smooth interpolation and sub-millisecond sync.
- **Native Settings**: Integrates a dedicated "Buttplug.io" tab into the Stash settings sidebar (`Settings -> Buttplug.io`).
- **Deep Integration**: Hooks directly into video lifecycle events (play, pause, seek, timeupdate) for instant responsiveness.
- **Multi-Device Support**: Controls Linear (Strokers), Vibration, and Rotation devices simultaneously.
- **Smart Fallbacks**: Generates vibration and rotation commands from linear strokes if specific scripts are missing.
- **Standalone**: Runs entirely in the browser using the latest `Buttplug.io` client, keeping your Stash installation lean.

## Installation

### Method 1: Add Source to StashApp (Recommended)

1. Go to **Settings > Plugins**.
2. Click **Sources** (top right) -> **Add Source**.
3. Enter the following details:
   - **Name**: stashButtplug
   - **URL**: `https://happykinkster.github.io/stash-buttplug/main/index.yml`
4. Click **Confirm**.
5. Go back to the **Available** plugins tab.
6. Install **stashButtplug**.


### Method 2: Manual Installation

1. **Locate Plugin Directory**: Find your Stash plugins directory (e.g., `C:\Users\<User>\.stash\plugins`).
2. **Copy Files**: Copy the `stashButtplug` folder into the `plugins` directory.
3. **Reload Plugins**: Go to Stash > Settings > System > Plugins and click "Reload Plugins".

## Usage

1. **Start Intiface Central**: Ensure Intiface Central is running (Port 12345, WebSockets enabled).
2. **Configure Connection**:
   - Go to **Settings > Buttplug.io**.
   - Ensure the **Server URL** is correct (Default: `ws://localhost:12345`).
   - Click **Connect**. It should show "Status: Connected".
3. **Play**:
   - Open a scene with a funscript.
   - Play the video. Your devices will sync automatically!

## Advanced Settings

Located in **Settings > Buttplug.io**:

- **Server URL**: The address of your Intiface Central server.
- **Latency**: Adjust timing synchronization (ms) to compensate for network or device delay.
- **Auto-Connect on Play**: When enabled, playing a video will automatically attempt to connect to Buttplug if not already connected.

## Troubleshooting

- **No "Buttplug.io" Tab**: Refresh the page. Check the browser console (F12) for "stashButtplug: Loading improved plugin...".
- **Not Syncing**: Ensure the scene has a funscript assigned in Stash. This plugin fetches the script from `/scene/<ID>/funscript`.
- **Connection Error**: Ensure Intiface is listening on `ws://localhost:12345` and that "Enable WebSockets" is checked in Intiface settings.

## Requirements

- StashApp v0.20+
- Intiface Central (or Engine) running locally.
- Modern desktop browser.
