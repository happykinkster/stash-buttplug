
(async function () {
    console.log("Stash-Buttplug: Loading...");

    // 1. Dynamic Import of Buttplug
    let Buttplug;
    try {
        Buttplug = await import('https://cdn.jsdelivr.net/npm/buttplug@3.0.0/dist/web/buttplug.mjs');
    } catch (e) {
        console.error("Stash-Buttplug: Failed to load Buttplug library", e);
        return;
    }

    const { ButtplugClient, ButtplugWebsocketConnector } = Buttplug;

    // 2. Global State
    let client = null;
    let currentScript = null; // { actions: [] }
    let scriptIndex = 0;
    let videoEl = null;

    // Default Config
    const defaults = {
        serverUrl: "ws://localhost:12345/buttplug",
        latency: 0,
        autoConnect: false,
        debug: false
    };

    // Load Config
    let config = { ...defaults };
    try {
        const saved = JSON.parse(localStorage.getItem('stash-bp-config'));
        if (saved) config = { ...config, ...saved };
    } catch (e) { }


    // 3. UI Setup
    async function setupUI() {
        // Wait for navbar or safe place
        while (!document.querySelector('.navbar-nav')) {
            await new Promise(r => setTimeout(r, 500));
        }

        const nav = document.querySelector('.navbar-nav');

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
                    <small style="color:#aaa; display:block; margin-top:5px;">Positive = Delay toy action</small>
                </div>

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

        // Inputs logic
        document.getElementById('bp-btn-save').onclick = () => {
            config.serverUrl = document.getElementById('bp-in-url').value;
            config.latency = parseInt(document.getElementById('bp-in-latency').value) || 0;
            config.autoConnect = document.getElementById('bp-in-auto').checked;

            localStorage.setItem('stash-bp-config', JSON.stringify(config));
            document.getElementById('bp-settings-modal').style.display = 'none';
            // alert("Settings Saved!");
        };
        document.getElementById('bp-btn-cancel').onclick = () => {
            document.getElementById('bp-settings-modal').style.display = 'none';
        }


        // Container
        const container = document.createElement('li');
        container.className = 'nav-item d-flex align-items-center';

        // Connect Button
        const btn = document.createElement('button');
        btn.className = 'btn btn-secondary nav-link mr-2';
        btn.innerHTML = `🔌 Toy`;
        btn.onclick = toggleConnection;

        // Status
        const status = document.createElement('span');
        status.id = 'bp-status';
        status.style.marginRight = '10px';
        status.style.color = 'red';
        status.style.fontSize = '0.8em';
        status.innerText = 'Disc';

        // Settings Button
        const setBtn = document.createElement('button');
        setBtn.className = 'btn btn-sm btn-dark';
        setBtn.innerHTML = '⚙️';
        setBtn.onclick = () => {
            // Populate fields
            document.getElementById('bp-in-url').value = config.serverUrl;
            document.getElementById('bp-in-latency').value = config.latency;
            document.getElementById('bp-in-auto').checked = config.autoConnect;
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
            status.innerText = 'Disc';
            status.style.color = 'red';
            client = null;
        } else {
            status.innerText = '...';
            client = new ButtplugClient("Stash Client");

            try {
                const connector = new ButtplugWebsocketConnector(config.serverUrl);
                await client.connect(connector);
                status.innerText = 'Conn';
                status.style.color = '#28a745';
                console.log("Stash-Buttplug: Connected to Server");

                await client.startScanning();
            } catch (e) {
                console.error(e);
                status.innerText = 'Err';
                // Only alert on manual attempt?
                // alert("Could not connect.");
            }
        }
    }

    // 4. Stash GQL Helper
    async function getScenePath(sceneId) {
        const query = `query FindScene($id: ID!) {
            findScene(id: $id) {
                paths { funscript }
            }
        }`;

        try {
            const req = await fetch('/graphql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, variables: { id: sceneId } })
            });
            const res = await req.json();
            return res.data?.findScene?.paths?.funscript;
        } catch (e) {
            return null;
        }
    }

    // 5. Funscript Loader
    async function loadFunscript() {
        const matches = window.location.pathname.match(/\/scenes\/(\d+)/);
        if (!matches) {
            currentScript = null;
            return;
        }
        const sceneId = matches[1];

        const path = await getScenePath(sceneId);
        if (!path) {
            currentScript = null;
            return;
        }

        // Fetch from Bridge
        try {
            const bridgeUrl = `http://localhost:9998/funscript?path=${encodeURIComponent(path)}`;
            const res = await fetch(bridgeUrl);
            if (!res.ok) throw new Error(res.statusText);
            const json = await res.json();
            currentScript = json;
            console.log("Stash-Buttplug: Funscript loaded!", currentScript.actions.length, "actions");
        } catch (e) {
            console.error("Stash-Buttplug: Bridge Error", e);
        }
    }

    // 6. Sync Logic
    function tick() {
        if (!client || !client.connected || !currentScript || !videoEl || videoEl.paused) {
            requestAnimationFrame(tick);
            return;
        }

        // Apply Latency
        const now = (videoEl.currentTime * 1000) - config.latency;

        while (scriptIndex < currentScript.actions.length - 1 && currentScript.actions[scriptIndex].at < now) {
            scriptIndex++;
        }

        if (scriptIndex > 0 && currentScript.actions[scriptIndex].at > now + 2000) {
            scriptIndex = 0;
        }

        const target = currentScript.actions[scriptIndex];
        const duration = target.at - now;

        if (duration > 0 && duration < 1000) {
            if (!target._sent) {
                const pos = target.pos / 100.0;
                client.devices.forEach(d => {
                    try {
                        d.linear(duration, pos).catch(e => { });
                    } catch (e) { }
                });
                target._sent = true;
            }
        }
        requestAnimationFrame(tick);
    }

    // 7. Video Hook
    function hookVideo() {
        const v = document.querySelector('video');
        if (v && v !== videoEl) {
            videoEl = v;
            v.onseeked = () => {
                scriptIndex = 0;
                if (currentScript) {
                    currentScript.actions.forEach(a => a._sent = false);
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
