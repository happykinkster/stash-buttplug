(async function () {
    console.log("stashButtplug: Loading...");

    // 1. Dynamic Import of Buttplug
    let Buttplug;
    try {
        Buttplug = await import('https://cdn.jsdelivr.net/npm/buttplug@3.2.2/dist/web/buttplug.mjs');
    } catch (e) {
        console.error("stashButtplug: Failed to load Buttplug library", e);
        return;
    }

    const { ButtplugClient, ButtplugBrowserWebsocketClientConnector } = Buttplug;

    // 2. Global State
    let client = null;
    let currentScript = null; // Object: { main: script, vibrate: script, rotate: script }

    // State for indices
    let state = {
        mainIdx: 0,
        vibeIdx: 0,
        rotateIdx: 0
    };

    let videoEl = null;

    // Default Config
    const defaults = {
        serverUrl: "ws://localhost:12345",
        latency: 0,
        autoConnect: false,
        debug: false,
        // Fallback Configuration
        fallbackVibration: true, // Use stroke speed for vibration if no vibrate script
        fallbackRotation: true,  // Use stroke speed for rotation if no rotate script
        vibeIntensity: 100, // %
        rotateIntensity: 100 // %
    };

    // Load Config
    let config = { ...defaults };
    try {
        const saved = JSON.parse(localStorage.getItem('stash-bp-config'));
        if (saved) config = { ...config, ...saved };
    } catch (e) { }


    // 3. UI Setup
    async function setupUI() {
        // Wait up to 10s for UI
        let attempts = 0;
        let nav = null;
        while (attempts < 20) {
            // Try standard selector
            nav = document.querySelector('.navbar-nav');

            // Fallback: Try to find the container of the "Settings" or "System" link
            if (!nav) {
                const settingsLink = document.querySelector('a[href="/settings"]');
                if (settingsLink) {
                    nav = settingsLink.closest('ul') || settingsLink.closest('div.d-flex');
                }
            }

            if (nav) break;

            await new Promise(r => setTimeout(r, 500));
            attempts++;
        }

        if (!nav) {
            console.error("stashButtplug: Navbar not found. Aborting UI setup.");
            return;
        }

        // Settings Modal HTML
        const modalHtml = `
        <div id="bp-settings-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; align-items:center; justify-content:center;">
            <div style="background:#222; padding:20px; border-radius:8px; width:400px; color:#fff; border:1px solid #555; text-align: left;">
                <h4 style="margin-top:0;">Buttplug Settings</h4>
                <hr style="background:#555;">
                
                <div class="form-group" style="margin-bottom:15px;">
                    <label style="display:block; margin-bottom:5px;">Server URL</label>
                    <input type="text" id="bp-in-url" class="form-control" style="width:100%; padding:5px; background:#333; color:#fff; border:1px solid #555;" value="${config.serverUrl}">
                </div>
                
                <div class="form-group" style="margin-bottom:15px;">
                    <label style="display:block; margin-bottom:5px;">Latency (ms)</label>
                    <input type="number" id="bp-in-latency" class="form-control" style="width:100%; padding:5px; background:#333; color:#fff; border:1px solid #555;" value="${config.latency}">
                </div>

                 <hr style="background:#555; margin: 15px 0;">
                 <h5 style="margin-bottom:10px;">Fallback Behavior</h5>
                 <p style="font-size:0.8em; color:#aaa;">If specific scripts (e.g. .vibrate.funscript) are missing, should we generate commands from the main script?</p>

                <!-- Fallback Vibrator -->
                <div class="form-check" style="margin-bottom:5px;">
                    <input type="checkbox" id="bp-in-fb-vibe" ${config.fallbackVibration ? 'checked' : ''}> 
                    <label for="bp-in-fb-vibe" style="display:inline; margin-left:5px;">Fallback Vibration</label>
                </div>
                <div style="margin-left: 20px; margin-bottom:10px;">
                    <label style="font-size:0.8em; color:#aaa;">Max Intensity: <span id="bp-val-vibe">${config.vibeIntensity}</span>%</label>
                    <input type="range" id="bp-in-vibe-val" min="10" max="100" value="${config.vibeIntensity}" style="width:100%;">
                </div>

                <!-- Fallback Rotator -->
                <div class="form-check" style="margin-bottom:5px;">
                    <input type="checkbox" id="bp-in-fb-rotate" ${config.fallbackRotation ? 'checked' : ''}> 
                    <label for="bp-in-fb-rotate" style="display:inline; margin-left:5px;">Fallback Rotation</label>
                </div>
                 <div style="margin-left: 20px; margin-bottom:15px;">
                    <label style="font-size:0.8em; color:#aaa;">Max Speed: <span id="bp-val-rotate">${config.rotateIntensity}</span>%</label>
                    <input type="range" id="bp-in-rotate-val" min="10" max="100" value="${config.rotateIntensity}" style="width:100%;">
                </div>

                <hr style="background:#555; margin: 15px 0;">

                <div class="form-check" style="margin-bottom:20px;">
                    <input type="checkbox" id="bp-in-auto" ${config.autoConnect ? 'checked' : ''}> 
                    <label for="bp-in-auto" style="display:inline; margin-left:5px;">Auto-Connect on Load</label>
                </div>
                
                <div style="display:flex; justify-content:flex-end; gap:10px;">
                    <button id="bp-btn-cancel" class="btn btn-secondary" style="padding:5px 15px; cursor:pointer;">Cancel</button>
                    <button id="bp-btn-save" class="btn btn-primary" style="padding:5px 15px; cursor:pointer; background:#007bff; color:white; border:none;">Save</button>
                </div>
            </div>
        </div>
        `;

        // Append modal to body
        const div = document.createElement('div');
        div.innerHTML = modalHtml;
        document.body.appendChild(div);

        // Slider listeners
        document.getElementById('bp-in-vibe-val').oninput = (e) => document.getElementById('bp-val-vibe').innerText = e.target.value;
        document.getElementById('bp-in-rotate-val').oninput = (e) => document.getElementById('bp-val-rotate').innerText = e.target.value;

        // Inputs logic
        document.getElementById('bp-btn-save').onclick = () => {
            config.serverUrl = document.getElementById('bp-in-url').value;
            config.latency = parseInt(document.getElementById('bp-in-latency').value) || 0;
            config.autoConnect = document.getElementById('bp-in-auto').checked;

            // New settings
            config.fallbackVibration = document.getElementById('bp-in-fb-vibe').checked;
            config.fallbackRotation = document.getElementById('bp-in-fb-rotate').checked;
            config.vibeIntensity = parseInt(document.getElementById('bp-in-vibe-val').value) || 100;
            config.rotateIntensity = parseInt(document.getElementById('bp-in-rotate-val').value) || 100;

            localStorage.setItem('stash-bp-config', JSON.stringify(config));
            document.getElementById('bp-settings-modal').style.display = 'none';
        };
        document.getElementById('bp-btn-cancel').onclick = () => {
            document.getElementById('bp-settings-modal').style.display = 'none';
        };

        // Container
        const container = document.createElement('li');
        container.className = 'nav-item d-flex align-items-center';

        // Connect Button
        const btn = document.createElement('button');
        btn.className = 'btn btn-secondary nav-link mr-2';
        btn.innerHTML = `🔌 Buttplug.io`;
        btn.onclick = toggleConnection;

        // Status
        const status = document.createElement('span');
        status.id = 'bp-status';
        status.style.marginRight = '10px';
        status.style.color = 'red';
        status.style.fontSize = '0.8em';
        status.innerText = 'Disconnected';

        // Settings Button
        const setBtn = document.createElement('button');
        setBtn.className = 'btn btn-sm btn-dark';
        setBtn.innerHTML = '⚙️';
        setBtn.onclick = () => {
            // Populate fields
            document.getElementById('bp-in-url').value = config.serverUrl;
            document.getElementById('bp-in-latency').value = config.latency;
            document.getElementById('bp-in-auto').checked = config.autoConnect;

            // Populate New settings
            document.getElementById('bp-in-fb-vibe').checked = config.fallbackVibration;
            document.getElementById('bp-in-fb-rotate').checked = config.fallbackRotation;

            document.getElementById('bp-in-vibe-val').value = config.vibeIntensity || 100;
            document.getElementById('bp-val-vibe').innerText = config.vibeIntensity || 100;

            document.getElementById('bp-in-rotate-val').value = config.rotateIntensity || 100;
            document.getElementById('bp-val-rotate').innerText = config.rotateIntensity || 100;

            document.getElementById('bp-settings-modal').style.display = 'flex';
        };

        container.appendChild(btn);
        container.appendChild(status);
        container.appendChild(setBtn);
        nav.appendChild(container); // Add to nav

        if (config.autoConnect) {
            setTimeout(toggleConnection, 1000);
        }
    }

    async function toggleConnection() {
        const status = document.getElementById('bp-status');
        if (client && client.connected) {
            await client.disconnect();
            status.innerText = 'Disconnected';
            status.style.color = 'red';
            client = null;
        } else {
            status.innerText = '...';
            client = new ButtplugClient("Stash Client");

            try {
                const connector = new ButtplugBrowserWebsocketClientConnector(config.serverUrl);
                await client.connect(connector);
                status.innerText = 'Connected';
                status.style.color = '#28a745';
                console.log("stashButtplug: Connected to Server");

                await client.startScanning();
            } catch (e) {
                console.error(e);
                status.innerText = 'Err';
            }
        }
    }

    // 4. Stash GQL Helper


    // Helper: Poll Task Status
    async function pollTask(taskId) {
        const query = `query FindTask($id: ID!) {
            findTask(id: $id) {
                status
                output
            }
        }`;

        let attempts = 0;
        while (attempts < 20) { // 10 seconds max
            await new Promise(r => setTimeout(r, 500));
            try {
                const req = await fetch('/graphql', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query, variables: { id: taskId } })
                });
                const res = await req.json();
                const task = res.data?.findTask;

                if (!task) return null;

                if (task.status === 'SUCCEEDED') {
                    // Output is usually the JSON content string
                    return task.output;
                } else if (task.status === 'FAILED') {
                    console.error("stashButtplug: Task Failed", task.output);
                    return null;
                }
                // If RUNNING/PENDING/QUEUED, continue
            } catch (e) { console.error(e); }
            attempts++;
        }
        console.error("stashButtplug: Task Polling Timed Out");
        return null;
    }



    // 5. Funscript Loader (Direct URL)
    async function loadFunscript() {
        const matches = window.location.pathname.match(/\/scenes\/(\d+)/);
        if (!matches) {
            currentScript = null;
            return;
        }
        const sceneId = matches[1];
        const scriptUrl = `/scene/${sceneId}/funscript`;

        try {
            console.log(`stashButtplug: Fetching funscript from ${scriptUrl}`);
            const req = await fetch(scriptUrl);

            if (req.status !== 200) {
                console.log(`stashButtplug: No funscript found (Status ${req.status}).`);
                currentScript = null;
                return;
            }

            const mainScript = await req.json();

            if (!mainScript.actions || !Array.isArray(mainScript.actions)) {
                console.error("stashButtplug: Invalid funscript format.", mainScript);
                currentScript = null;
                return;
            }

            // Direct URL only provides the main script.
            // We explicitely set vibrate/rotate to null to trigger internal fallback logic.
            currentScript = {
                main: mainScript,
                vibrate: null,
                rotate: null
            };

            console.log(`stashButtplug: Loaded Main Script (${mainScript.actions.length} actions). Fallbacks enabled.`);

        } catch (e) {
            console.error("stashButtplug: Exception loading funscript", e);
            currentScript = null;
        }
    }

    function updateIndex(script, idx, time) {
        if (!script) return 0;
        let i = idx;

        // Reset if wrapped
        if (i >= script.actions.length) i = 0;
        // Or if time jumped back
        if (i > 0 && script.actions[i].at > time + 1000) i = 0;

        while (i < script.actions.length - 1 && script.actions[i].at < time) {
            i++;
        }
        return i;
    }

    // Helper: Stop all devices
    function stopAllDevices() {
        if (client && client.connected) {
            client.devices.forEach(d => {
                if (d.vibrate) d.vibrate(0).catch(() => { });
                if (d.rotate) d.rotate(0, true).catch(() => { });
                if (d.stop) d.stop().catch(() => { });
            });
        }
    }

    let wasPaused = true;

    // 6. Sync Logic
    function tick() {
        if (!client || !client.connected || !currentScript || !videoEl) {
            requestAnimationFrame(tick);
            return;
        }

        // Handle Pause
        if (videoEl.paused) {
            if (!wasPaused) {
                console.log("stashButtplug: Video paused, stopping devices.");
                stopAllDevices();
                wasPaused = true;
            }
            requestAnimationFrame(tick);
            return;
        }
        wasPaused = false;

        const now = (videoEl.currentTime * 1000) - config.latency;

        // Update Indices
        state.mainIdx = updateIndex(currentScript.main, state.mainIdx, now);
        state.vibeIdx = updateIndex(currentScript.vibrate, state.vibeIdx, now);
        state.rotateIdx = updateIndex(currentScript.rotate, state.rotateIdx, now);

        // 1. Process Main Action (Linear)
        // Ensure we have a valid action
        const mainTarget = currentScript.main.actions[state.mainIdx];
        if (!mainTarget) {
            requestAnimationFrame(tick);
            return;
        }

        const mainDuration = mainTarget.at - now;

        let shouldSendMain = false;
        // Only trigger action if close enough (active segment)
        if (mainDuration > 0 && mainDuration < 1000 && !mainTarget._sent) {
            shouldSendMain = true;
            mainTarget._sent = true;
        }

        // Calculate Fallback Speed
        let fallbackIntensity = 0;
        if (shouldSendMain) {
            const lastPos = currentScript.main.actions[state.mainIdx - 1] ? currentScript.main.actions[state.mainIdx - 1].pos : mainTarget.pos;
            const dist = Math.abs(mainTarget.pos - lastPos) / 100.0;
            const durSec = mainDuration / 1000.0;
            const speed = durSec > 0 ? (dist / durSec) : 0;
            fallbackIntensity = Math.min(speed / 4.0, 1.0); // Clamp
            if (dist < 0.01) fallbackIntensity = 0;
        }

        // Detect "Gap" (Next action is far away)
        // If we represent a gap as > 2 seconds to next point
        const isGap = mainDuration > 2000;

        // Execute Commands
        client.devices.forEach(d => {
            // A. Linear (Main Script)
            if (shouldSendMain && d.linear) {
                d.linear(mainDuration, mainTarget.pos / 100.0).catch(e => { });
            }

            // B. Vibration
            if (d.vibrate) {
                if (currentScript.vibrate) {
                    const idx = state.vibeIdx;
                    const action = currentScript.vibrate.actions[idx];
                    if (action) {
                        const dur = action.at - now;
                        if (dur > 0 && dur < 500 && !action._sent) {
                            const intensity = (action.pos / 100.0) * ((config.vibeIntensity || 100) / 100.0);
                            d.vibrate(intensity).catch(e => { });
                            action._sent = true;
                        }
                    }
                } else if (config.fallbackVibration) {
                    if (shouldSendMain) {
                        const intensity = fallbackIntensity * ((config.vibeIntensity || 100) / 100.0);
                        d.vibrate(intensity).catch(e => { });
                    } else if (isGap) {
                        // Stop vibration during gaps
                        d.vibrate(0).catch(() => { });
                    }
                }
            }

            // C. Rotation
            if (d.rotate) {
                if (currentScript.rotate) {
                    const idx = state.rotateIdx;
                    const action = currentScript.rotate.actions[idx];
                    if (action) {
                        const dur = action.at - now;
                        if (dur > 0 && dur < 500 && !action._sent) {
                            const speed = (action.pos / 100.0) * ((config.rotateIntensity || 100) / 100.0);
                            d.rotate(speed, true).catch(e => { });
                            action._sent = true;
                        }
                    }
                } else if (config.fallbackRotation) {
                    if (shouldSendMain) {
                        const speed = fallbackIntensity * ((config.rotateIntensity || 100) / 100.0);
                        d.rotate(speed, true).catch(e => { });
                    } else if (isGap) {
                        // Stop rotation during gaps
                        d.rotate(0, true).catch(() => { });
                    }
                }
            }
        });

        requestAnimationFrame(tick);
    }

    // 7. Video Hook
    function hookVideo() {
        const v = document.querySelector('video');
        if (v && v !== videoEl) {
            videoEl = v;
            v.onseeked = () => {
                // Reset indices
                state.mainIdx = 0;
                state.vibeIdx = 0;
                state.rotateIdx = 0;
                if (currentScript) {
                    // Reset sent flags
                    if (currentScript.main) currentScript.main.actions.forEach(a => a._sent = false);
                    if (currentScript.vibrate) currentScript.vibrate.actions.forEach(a => a._sent = false);
                    if (currentScript.rotate) currentScript.rotate.actions.forEach(a => a._sent = false);
                }
            };
            loadFunscript();
        }
    }

    // Initialize
    setupUI();

    // Watch for navigation
    let lastUrl = location.href;
    new MutationObserver(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            setTimeout(loadFunscript, 1000);
        }
        hookVideo();
    }).observe(document.body, { childList: true, subtree: true });

    setInterval(hookVideo, 2000);
    requestAnimationFrame(tick);

})();
