(async function () {
    const { React, ReactDOM, libraries, register, patch } = window.PluginApi;

    console.log("stashButtplug: Loading improved plugin (Surgical Safety Mode)...");

    // --- 1. Utility Functions ---
    function convertRange(value, fromLow, fromHigh, toLow, toHigh) {
        return ((Number(value) - fromLow) * (toHigh - toLow)) / (fromHigh - fromLow) + toLow;
    }

    // --- 2. Ported FunscriptPlayer ---
    class FunscriptPlayer {
        constructor(posCallback, offset = 0, hzRate = 60) {
            this._posCallback = posCallback;
            this._offset = offset;
            this._hzRate = hzRate;
            this._funscript = undefined;
            this._paused = true;
            this._currTime = 0;
            this._currAt = 0;
            this._prevTime = 0;
            this._prevAt = 0;
            this._actionIndex = -1;
            this._prevAction = null;
            this._prevPos = null;
            this._timeoutId = undefined;
            this._startPos = 50;
        }

        set funscript(json) {
            this.pause();
            this._funscript = json;
            if (this._funscript?.inverted && Array.isArray(this._funscript.actions)) {
                this._funscript.actions = this._funscript.actions.map(a => {
                    a.pos = convertRange(a.pos, 0, 100, 100, 0);
                    return a;
                });
            }
        }

        get hzRate() { return this._hzRate; }

        play(at = 0) {
            if (!this._funscript) return;
            this.cancelLoop();
            this._paused = false;
            this._prevTime = this._currTime = Date.now();
            this._prevAt = this._currAt = at;
            this._actionIndex = this._funscript.actions.findIndex(
                action => (at < (action.at + this._offset))
            );
            this._prevAction = { at, pos: this._prevPos || this._startPos };
            this.runLoop();
        }

        playSync(at) {
            this._prevTime = this._currTime;
            this._prevAt = this._currAt;
            this._currTime = Date.now();
            this._currAt = at;
        }

        pause() {
            this._paused = true;
            this.cancelLoop();
        }

        cancelLoop() {
            if (this._timeoutId) {
                clearTimeout(this._timeoutId);
                this._timeoutId = undefined;
            }
        }

        nextAt(now) {
            const nowTimeDelta = now - this._currTime;
            const lastTimeDelta = this._currTime - this._prevTime;
            const lastAtDelta = this._currAt - this._prevAt;
            if (lastTimeDelta === 0 || lastAtDelta === 0) {
                return this._currAt + nowTimeDelta;
            }
            return this._currAt + Math.trunc(convertRange(nowTimeDelta, 0, lastTimeDelta, 0, lastAtDelta));
        }

        runLoop() {
            this._timeoutId = setTimeout(() => {
                if (this._paused || !this._funscript || !this._prevAction || this._actionIndex < 0) return;

                const at = this.nextAt(Date.now());
                if (!this.advanceKeyframes(at)) return;

                const currAction = this._funscript.actions[this._actionIndex];
                let pos = this._prevAction.pos;
                if (this._prevAction.at !== currAction.at && this._prevAction.pos !== currAction.pos) {
                    pos = Math.round(convertRange(at,
                        this._prevAction.at + this._offset, currAction.at + this._offset,
                        this._prevAction.pos, currAction.pos
                    ));
                }

                if (pos !== this._prevPos && pos >= 0 && pos <= 100) {
                    this._posCallback(pos);
                    this._prevPos = pos;
                }
                this.runLoop();
            }, 1000 / this._hzRate);
        }

        advanceKeyframes(currAt) {
            if (!this._funscript) return false;
            let currAction = this._funscript.actions[this._actionIndex];
            if (currAt < (currAction.at + this._offset)) return true;

            let isAtEndOfActions = this._actionIndex >= (this._funscript.actions.length - 1);
            if (isAtEndOfActions) return false;

            do {
                this._prevAction = currAction;
                this._actionIndex++;
                currAction = this._funscript.actions[this._actionIndex];
                isAtEndOfActions = this._actionIndex >= this._funscript.actions.length - 1;
            } while ((currAt < (this._prevAction.at + this._offset)) && !isAtEndOfActions);

            return currAt < (currAction.at + this._offset);
        }
    }

    // --- 3. Ported ButtplugInteractive ---
    class ButtplugInteractive {
        constructor() {
            this._client = null;
            this._connector = null;
            this._ButtplugDocs = null;
            this._funscriptPlayer = new FunscriptPlayer(async (pos) => {
                await this.sendToDevice(pos);
            });
            this._config = this._loadConfig();
        }

        _loadConfig() {
            const defaults = {
                serverUrl: "ws://localhost:12345",
                latency: 0,
                autoConnect: false,
                vibeIntensity: 100,
                rotateIntensity: 100
            };
            try {
                const savedString = localStorage.getItem('stash-bp-config');
                const saved = savedString ? JSON.parse(savedString) : {};
                return { ...defaults, ...saved };
            } catch (e) { return defaults; }
        }

        async initButtplug() {
            if (this._ButtplugDocs) return;
            try {
                this._ButtplugDocs = await import('https://cdn.jsdelivr.net/npm/buttplug@3.2.2/dist/web/buttplug.mjs');
                const { ButtplugClient, ButtplugBrowserWebsocketClientConnector } = this._ButtplugDocs;
                this._client = new ButtplugClient("Stash Plugin");
                this._connector = new ButtplugBrowserWebsocketClientConnector(this._config.serverUrl);
            } catch (e) { console.error("stashButtplug: Library error", e); }
        }

        async connect() {
            await this.initButtplug();
            if (this._client && this._client.connected) return;
            try {
                await this._client.connect(this._connector);
                await this._client.startScanning().catch(() => { });
                setTimeout(() => {
                    if (this._client && this._client.connected) {
                        this._client.stopScanning().catch(() => { });
                    }
                }, 5000);
            } catch (e) {
                console.error("stashButtplug: Connect failure", e);
                throw e;
            }
        }

        async disconnect() {
            if (this._client && this._client.connected) {
                await this._client.disconnect().catch(() => { });
            }
        }

        async checkConnection() {
            if (this._config.autoConnect && (!this._client || !this._client.connected)) {
                await this.connect().catch(() => { });
            }
        }

        async sendToDevice(pos) {
            if (!this._client || !this._client.connected) return;
            const intensity = Number(this._config.vibeIntensity || 100) / 100;
            const rotateScale = Number(this._config.rotateIntensity || 100) / 100;
            const position = Number(pos) / 100;

            for (const device of this._client.devices) {
                try {
                    if (device.vibrateAttributes && device.vibrateAttributes.length > 0) {
                        await device.vibrate(position * intensity).catch(() => { });
                    }
                    if (device.linearAttributes && device.linearAttributes.length > 0) {
                        await device.linear(position, 16).catch(() => { });
                    }
                    if (device.rotateAttributes && device.rotateAttributes.length > 0) {
                        await device.rotate(position * rotateScale, true).catch(() => { });
                    }
                } catch (e) { }
            }
        }

        async uploadScript(funscriptPath) {
            if (!funscriptPath) return;
            try {
                const json = await fetch(funscriptPath).then(r => r.json());
                this._funscriptPlayer.funscript = json;
            } catch (e) { }
        }

        async play(at) {
            await this.checkConnection();
            this._funscriptPlayer._offset = -Number(this._config.latency || 0);
            this._funscriptPlayer.play(Math.trunc(Number(at) * 1000));
        }

        async pause() {
            this._funscriptPlayer.pause();
            if (this._client && this._client.connected) {
                for (const device of this._client.devices) {
                    await device.stop().catch(() => { });
                }
            }
        }

        sync(at) {
            this._funscriptPlayer.playSync(Math.trunc(Number(at) * 1000));
        }
    }

    const manager = new ButtplugInteractive();

    // --- 5. UI Component (Defined outside for stability) ---
    const ButtplugSettingsComponent = () => {
        const [config, setConfig] = React.useState(() => ({ ...manager._config }));
        const [connStatus, setConnStatus] = React.useState("Disconnected");

        React.useEffect(() => {
            const i = setInterval(() => {
                const isConnected = !!(manager._client && manager._client.connected);
                setConnStatus(isConnected ? "Connected" : "Disconnected");
            }, 1000);
            return () => clearInterval(i);
        }, []);

        const handleSave = () => {
            try {
                localStorage.setItem('stash-bp-config', JSON.stringify(config));
                manager._config = config;
                if (manager._client && manager._ButtplugDocs) {
                    const { ButtplugBrowserWebsocketClientConnector } = manager._ButtplugDocs;
                    manager._connector = new ButtplugBrowserWebsocketClientConnector(config.serverUrl);
                }
                alert("Settings Saved successfully.");
            } catch (err) {
                alert("Error saving settings.");
            }
        };

        const toggleConn = async () => {
            try {
                if (manager._client && manager._client.connected) {
                    await manager.disconnect();
                } else {
                    await manager.connect();
                }
            } catch (err) {
                alert("Connection failed.");
            }
        };

        return React.createElement("div", { className: "buttplug-settings-panel" },
            React.createElement("hr", null),
            React.createElement("h1", { className: "mb-3" }, "Buttplug.io (Intiface)"),

            // Server URL
            React.createElement("div", { className: "setting row mb-3" },
                React.createElement("div", { className: "col-12 col-md-6" },
                    React.createElement("h3", null, "Server URL"),
                    React.createElement("div", { className: "sub-heading text-muted" }, "The address of your Intiface Central server")
                ),
                React.createElement("div", { className: "col-12 col-md-6" },
                    React.createElement("input", {
                        className: "form-control",
                        type: "text",
                        value: String(config.serverUrl || ""),
                        onChange: e => setConfig({ ...config, serverUrl: e.target.value })
                    })
                )
            ),

            // Latency
            React.createElement("div", { className: "setting row mb-3" },
                React.createElement("div", { className: "col-12 col-md-6" },
                    React.createElement("h3", null, "Latency (ms)"),
                    React.createElement("div", { className: "sub-heading text-muted" }, "Adjust timing synchronization")
                ),
                React.createElement("div", { className: "col-12 col-md-6" },
                    React.createElement("input", {
                        className: "form-control",
                        type: "number",
                        value: Number(config.latency || 0),
                        onChange: e => setConfig({ ...config, latency: parseInt(e.target.value) || 0 })
                    })
                )
            ),

            // Auto Connect
            React.createElement("div", { className: "setting row mb-3" },
                React.createElement("div", { className: "col-12 col-md-6" },
                    React.createElement("h3", null, "Auto-Connect"),
                    React.createElement("div", { className: "sub-heading text-muted" }, "Connect on play")
                ),
                React.createElement("div", { className: "col-12 col-md-6" },
                    React.createElement("input", {
                        type: "checkbox",
                        className: "mr-2",
                        id: "bp-auto-connect-check",
                        checked: Boolean(config.autoConnect),
                        onChange: e => setConfig({ ...config, autoConnect: e.target.checked })
                    }),
                    React.createElement("label", { htmlFor: "bp-auto-connect-check", className: "m-0" }, "Enable")
                )
            ),

            // Actions
            React.createElement("div", { className: "d-flex align-items-center mt-4" },
                React.createElement("button", {
                    className: "btn btn-primary mr-2",
                    onClick: handleSave
                }, "Save Settings"),
                React.createElement("button", {
                    className: (manager._client && manager._client.connected) ? "btn btn-danger mr-2" : "btn btn-success mr-2",
                    onClick: toggleConn
                }, (manager._client && manager._client.connected) ? "Disconnect" : "Connect"),
                React.createElement("span", { className: "ml-3 font-weight-bold" }, "Status: " + String(connStatus))
            )
        );
    };

    // --- 6. UI Integration ---
    async function setupUI() {
        console.log("stashButtplug: Registering surgical UI patch...");
        patch.after("SettingsInterfacePanel", (props, result) => {
            // ULTRA-SAFE NESTING:
            // We return a new Fragment that contains the original result 
            // and OUR component at the bottom. This prevents us from
            // breaking any internal array structures or indices of the core.
            return React.createElement(React.Fragment, null,
                result,
                React.createElement("div", { className: "setting-section pb-5", key: "bp-outer-section" },
                    React.createElement(ButtplugSettingsComponent, null)
                )
            );
        });
    }

    setupUI();
    setInterval(hookVideo, 2000);
    new MutationObserver(hookVideo).observe(document.body, { childList: true, subtree: true });

    console.log("stashButtplug: Plugin fully initialized.");
})();
