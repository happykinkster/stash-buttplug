# Stash-Buttplug Plugin

This plugin connects StashApp to Buttplug.io (Intiface) to control devices like the Kiiroo Keon using Funscripts synced with your scenes.

## Features
- **Frontend Integration**: Adds a "Buttplug.io" button to the Stash navbar to connect/disconnect.
- **Funscript Support**: Automatically finds the funscript associated with the playing scene and syncs it.
- **Direct Integration**: Runs entirely in the browser, fetching funscripts directly from Stash.
- **Intiface Support**: Connects to standard Intiface Central websocket (`ws://localhost:12345`).

## Installation

### Method 1: Add Source to StashApp (Recommended)

1. Go to **Settings > Plugins**.
2. Click **Sources** (top right) -> **Add Source**.
3. Enter the following details:
   - **Name**: stashButtplug
   - **URL**:  `https://happykinkster.github.io/stash-buttplug/main/index.yml`
4. Click **Confirm**.
5. Go back to the **Available** plugins tab.
6. Install **stashButtplug**.


### Method 2: Manual Installation

1. **Locate Plugin Directory**: Find your Stash plugins directory (e.g., `C:\Users\<User>\.stash\plugins`).
2. **Copy Files**: Copy the `stashButtplug` folder into the `plugins` directory.
3. **Reload Plugins**: Go to Stash > Settings > System > Plugins and click "Reload Plugins".

## Usage

1. **Start Intiface Central**: Ensure Intiface Central is running (Port 12345, WebSockets enabled).
2. **Connect Buttplug.io**:
   - Refresh Stash.
   - Click the **🔌 Buttplug.io** button in the top navbar (or in the settings menu/sidebar depending on your theme).
   - It should turn Green when connected.
3. **Play**:
   - Open a scene with a funscript.
   - Play the video. Your device should respond!

## Settings
Click the **Gear (⚙️)** icon next to the Buttplug.io button to configure:
- **Server URL**: The address of your Intiface Central server (Default: `ws://localhost:12345`).
- **Latency**: Adjust timing synchronization (ms).
- **Auto-Connect**: Connect on load.
- **Fallback Behavior**:
  - **Fallback Vibration/Rotation**: Use the main script to generate vibrations/rotations.
  - **Intensity/Speed**: Set the max intensity/speed for the fallback generation.

## Troubleshooting

- **No "Buttplug.io" Button**: Check F12 Console for errors. Ensure `main.js` is loaded.
- **Not Loading Script**: Ensure the scene has a funscript assigned in Stash. Check F12 Console for "Funscript loaded!" message.
- **Connection Error**: Ensure Intiface is listening on `ws://localhost:12345`.

## Requirements
- StashApp
- Intiface Central (or Engine) running locally.
