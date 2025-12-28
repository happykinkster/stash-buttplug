# Stash-Buttplug Plugin

This plugin connects StashApp to Buttplug.io (Intiface) to control devices like the Kiiroo Keon using Funscripts synced with your scenes.

## Features
- **Frontend Integration**: Adds a "Toy" button to the Stash navbar to connect/disconnect.
- **Funscript Support**: Automatically finds the funscript associated with the playing scene and syncs it.
- **Bridge Server**: Includes a Python bridge to securely serve funscript files from your disk to the browser.
- **Intiface Support**: Connects to standard Intiface Central websocket (`ws://localhost:12345`).

## Installation

### Method 1: Add Source to StashApp (Recommended)

1. Go to **Settings > Plugins**.
2. Click **Sources** (top right) -> **Add Source**.
3. Enter the following details:
   - **Name**: Stash-Buttplug
   - **URL**: `https://raw.githubusercontent.com/happykinkster/stash-buttplug/main/index.yml`
4. Click **Confirm**.
5. Go back to the **Available** plugins tab.
6. Install **Stash-Buttplug**.

### Method 2: Manual Installation

1. **Locate Plugin Directory**: Find your Stash plugins directory. This is usually in your Stash configuration folder (e.g., `C:\Users\<User>\.stash\plugins` or alongside your `stash-go.exe`).
2. **Copy Files**: Copy the entire `stash-buttplug` folder into the `plugins` directory.
   - Structure should be: `.../plugins/stash-buttplug/plugin.yml`
3. **Reload Plugins**: Go to Stash > Settings > System > Plugins and click "Reload Plugins".

## Usage

1. **Start Intiface Central**: Make sure Intiface Central is running and the Server is started (Port 12345, WebSockets enabled).
2. **Start the Bridge**:
   - In Stash, go to **Settings > Tasks**.
   - Find "Start Buttplug Bridge" and click **Run**.
   - Check the Logs/Terminal to ensure it says "Stash-Buttplug Bridge running...".
   - *Note: You need to run this once every time you restart Stash, or keep it running.*
3. **Connect Toy**:
   - Refresh Stash.
   - You should see a **🔌 Toy** button in the top navbar.
   - Click it to connect to Intiface.
   - It should turn Green.

## Settings
Click the **Gear (⚙️)** icon next to the Toy button to configure:
- **Server URL**: The address of your Intiface Central server (Default: `ws://localhost:12345/buttplug`).
- **Latency**: Adjust the timing of the toy in milliseconds. Positive values delay the toy, negative values make it run earlier.
- **Auto-Connect**: Automatically attempt to connect to Intiface when Stash loads.

4. **Play**:
   - Open a scene that has a matched funscript.
   - The plugin log (F12 Console) will say "Funscript loaded!".
   - Play the video. Your device should respond!

## Troubleshooting

- **No "Toy" Button**: Check the browser console (F12) for errors. Ensure `main.js` is loaded (Network tab).
- **Not Loading Script**: Ensure the "Buttplug Bridge" task is running. Ensure the funscript path in Stash is correct and accessible.
- **Connection Error**: Ensure Intiface is listening on `ws://localhost:12345`.
- **Latency**: If the sync is off, you might need to adjust the code variable `LATENCY` (currently implicitly 0).

## Requirements
- Python installed and in your system PATH (for the bridge).
- Internet access (to load Buttplug library from CDN).
