# Stash-Buttplug Plugin

This plugin connects StashApp to Buttplug.io (Intiface) to control devices like the Kiiroo Keon, vibrators, and rotators using Funscripts synced with your scenes. 

## Installation

### Method 1: Add Source to StashApp (Recommended)

1. Go to **Settings > Plugins**.
2. Click **Sources** (top right) -> **Add Source**.
3. Enter the following details:
   - **Name**: stashInteractive
   - **URL**: `https://happykinkster.github.io/stashInteractive/main/index.yml`
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
    - Go to **Settings -> Interface**.
    - Scroll to the bottom to find the **Buttplug.io (Intiface)** section.
    - Ensure the **Server URL** is correct (Default: `ws://localhost:12345`).
    - Click **Connect**. It should show "Status: Connected".
3. **Play**:
    - Open a scene with a funscript.
    - Play the video. Your devices will sync automatically!

## Advanced Settings

Located at the bottom of **Settings -> Interface**:

- **Server URL**: The address of your Intiface Central server.
- **Latency**: Adjust timing synchronization (ms) to compensate for network or device delay.
- **Auto-Connect**: When enabled, playing a video will automatically attempt to connect to Buttplug if not already connected.
- **Update Rate (Hz)**: Frequency of commands sent to devices. Default is **20Hz** (recommended for Bluetooth). Increase to **60Hz** for wired devices if you want maximum precision.

## Troubleshooting

- **No Buttplug Settings**: Refresh the page with (Ctrl+F5). Go to **Settings -> Interface** and scroll to the bottom. Check the browser console (F12) for "stashButtplug: Loading plugin...".
- **Not Syncing**: Ensure the scene has a funscript assigned in Stash. This plugin fetches the script from `/scene/<ID>/funscript`.
- **Connection Error**: Ensure Intiface is listening on `ws://localhost:12345` and that "Enable WebSockets" is checked in Intiface settings.
- **Connection Error (HTTPS/Mixed Content)**: If you use Stash via HTTPS (e.g., `https://stash.example.com`), browsers block connections to local `ws://` addresses. 
    - **Solution 1 (Recommended)**: Access Stash via `http://` instead of `https://`.
    - **Solution 2 (Chrome/Edge)**: 
        1. Click the **Lock icon** (or "Not secure") on the left of the address bar.
        2. Select **Site settings**.
        3. Find **Insecure content** and set it to **Allow**.
        4. Refresh the page.
    - **Solution 3 (Advanced)**: Change the Server URL to `ws://127.0.0.1:12345`.
- **Jerky Movement / Lag**: Bluetooth devices often cannot handle high-speed updates. Ensure **Update Rate** is set to **20Hz** (or lower). If using a wired device, you can try increasing this to 60Hz.

## Requirements

- StashApp v0.20+
- Intiface Central (or Engine) running locally.
- Modern desktop browser.
