(async function () {
    const { React, ReactDOM, libraries, register, patch, components } = window.PluginApi;
    const { Button, Form, Modal, Nav, Tab } = libraries.Bootstrap;

    console.log("stashButtplug: Loading improved plugin...");

    // --- 1. Utility Functions ---
    function convertRange(value, fromLow, fromHigh, toLow, toHigh) {
        return ((value - fromLow) * (toHigh - toLow)) / (fromHigh - fromLow) + toLow;
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
            if (this._funscript?.inverted) {
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
            this._config = this.loadConfig();
        }

        loadConfig() {
            const defaults = {
                serverUrl: "ws://localhost:12345",
                latency: 0,
                autoConnect: false,
                vibeIntensity: 100,
                rotateIntensity: 100
            };
            try {
                const saved = JSON.parse(localStorage.getItem('stash-bp-config'));
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

                this._client.addListener("deviceadded", (device) => console.log(`[buttplug] Device Added: ${device.name}`));
                this._client.addListener("deviceremoved", (device) => console.log(`[buttplug] Device Removed: ${device.name}`));
            } catch (e) {
                console.error("stashButtplug: Failed to load Buttplug library", e);
            }
        }

        async connect() {
            await this.initButtplug();
            if (this._client.connected) return;
            try {
                await this._client.connect(this._connector);
                await this._client.startScanning();
                setTimeout(() => this._client.stopScanning().catch(() => { }), 5000);
            } catch (e) {
                console.error("stashButtplug: Connection failed", e);
                throw e;
            }
        }

        async disconnect() {
            if (this._client?.connected) {
                await this._client.disconnect();
            }
        }

        async checkConnection() {
            if (!this._client?.connected && this._config.autoConnect) {
                await this.connect().catch(() => { });
            }
        }

        async sendToDevice(pos) {
            if (!this._client?.connected) return;
            for (const device of this._client.devices) {
                if (device.vibrateAttributes.length > 0) {
                    const intensity = (pos / 100) * (this._config.vibeIntensity / 100);
                    await device.vibrate(intensity).catch(() => { });
                }
                if (device.linearAttributes.length > 0) {
                    const duration = Math.round(1000 / this._funscriptPlayer.hzRate);
                    await device.linear(pos / 100, duration).catch(() => { });
                }
                if (device.rotateAttributes.length > 0) {
                    const speed = (pos / 100) * (this._config.rotateIntensity / 100);
                    await device.rotate(speed, true).catch(() => { });
                }
            }
        }

        async uploadScript(funscriptPath) {
            if (!funscriptPath) {
                this._funscriptPlayer.funscript = undefined;
                return;
            }
            try {
                const json = await fetch(funscriptPath).then(r => r.json());
                this._funscriptPlayer.funscript = json;
            } catch (e) { console.error("stashButtplug: Failed to fetch funscript", e); }
        }

        async play(at) {
            await this.checkConnection();
            this._funscriptPlayer.offset = -this._config.latency;
            this._funscriptPlayer.play(Math.trunc(at * 1000));
        }

        async pause() {
            this._funscriptPlayer.pause();
            if (this._client?.connected) {
                for (const device of this._client.devices) {
                    await device.stop().catch(() => { });
                }
            }
        }

        sync(at) {
            this._funscriptPlayer.playSync(Math.trunc(at * 1000));
        }
    }

    // --- 4. Interactive Manager ---
    const manager = new ButtplugInteractive();
    let currentVideo = null;

    function hookVideo() {
        const v = document.querySelector('video');
        if (v && v !== currentVideo) {
            console.log("stashButtplug: Hooking new video element");
            currentVideo = v;

            const sceneId = window.location.pathname.match(/\/scenes\/(\d+)/)?.[1];
            if (sceneId) {
                manager.uploadScript(`/scene/${sceneId}/funscript`);
            }

            v.onplaying = () => manager.play(v.currentTime);
            v.onpause = () => manager.pause();
            v.ontimeupdate = () => manager.sync(v.currentTime);
            v.onseeked = () => {
                manager.pause();
                manager.play(v.currentTime);
            };
        }
    }

    // --- 5. UI Integration ---
    async function setupUI() {
        // Add Buttplug Settings to Settings Sidebar
        patch.after("Settings", (props, result) => {
            // This is a coarse patch, we'd ideally patch the sidebar but Stash sidebar is dynamic
            return result;
        });

        // Register a distinct route for Buttplug Settings
        const ButtplugSettingsPage = () => {
            const [config, setConfig] = React.useState(manager._config);
            const [status, setStatus] = React.useState(manager._client?.connected ? "Connected" : "Disconnected");

            const handleSave = () => {
                localStorage.setItem('stash-bp-config', JSON.stringify(config));
                manager._config = config;
                // Update connector if URL changed
                if (manager._client) {
                    const { ButtplugBrowserWebsocketClientConnector } = manager._ButtplugDocs;
                    manager._connector = new ButtplugBrowserWebsocketClientConnector(config.serverUrl);
                }
            };

            const toggleConn = async () => {
                if (manager._client?.connected) {
                    await manager.disconnect();
                } else {
                    await manager.connect();
                }
                setStatus(manager._client?.connected ? "Connected" : "Disconnected");
            };

            return React.createElement("div", { className: "container-fluid" },
                React.createElement("div", { className: "row" },
                    React.createElement("div", { className: "col-md-12" },
                        React.createElement("h1", null, "Buttplug.io Settings"),
                        React.createElement("hr", null),
                        React.createElement(Form.Group, null,
                            React.createElement(Form.Label, null, "Server URL"),
                            React.createElement(Form.Control, {
                                type: "text",
                                value: config.serverUrl,
                                onChange: e => setConfig({ ...config, serverUrl: e.target.value })
                            })
                        ),
                        React.createElement(Form.Group, null,
                            React.createElement(Form.Label, null, "Latency (ms)"),
                            React.createElement(Form.Control, {
                                type: "number",
                                value: config.latency,
                                onChange: e => setConfig({ ...config, latency: parseInt(e.target.value) || 0 })
                            })
                        ),
                        React.createElement(Form.Check, {
                            type: "checkbox",
                            label: "Auto-Connect on Play",
                            checked: config.autoConnect,
                            onChange: e => setConfig({ ...config, autoConnect: e.target.checked })
                        }),
                        React.createElement("hr", null),
                        React.createElement("div", { className: "d-flex align-items-center" },
                            React.createElement(Button, { className: "mr-2", onClick: handleSave }, "Save Settings"),
                            React.createElement(Button, { variant: manager._client?.connected ? "danger" : "success", onClick: toggleConn },
                                manager._client?.connected ? "Disconnect" : "Connect"
                            ),
                            React.createElement("span", { className: "ml-3" }, `Status: ${status}`)
                        )
                    )
                )
            );
        };

        register.route("/settings/buttplug", ButtplugSettingsPage);

        // Add Buttplug Settings to Settings Sidebar
        patch.after("SettingTabs", (props, result) => {
            const row = result.props.children[2];
            if (!row || !row.props || !row.props.children) return result;

            const menuCol = row.props.children[0];
            const contentCol = row.props.children[1];

            const nav = menuCol.props.children;
            const content = contentCol.props.children;

            // Add Nav Link
            const navLink = React.createElement(Nav.Item, { key: "buttplug-nav" },
                React.createElement(libraries.ReactRouterBootstrap.LinkContainer, { to: "/settings?tab=buttplug" },
                    React.createElement(Nav.Link, { eventKey: "buttplug" }, "Buttplug.io")
                )
            );

            // Insert before advanced switch (last child of Nav)
            if (nav && nav.props && Array.isArray(nav.props.children)) {
                nav.props.children.splice(nav.props.children.length - 2, 0, navLink);
            }

            // Add Tab Pane
            const tabPane = React.createElement(Tab.Pane, { key: "buttplug-pane", eventKey: "buttplug" },
                React.createElement(ButtplugSettingsPage, null)
            );
            if (content && content.props && Array.isArray(content.props.children)) {
                content.props.children.push(tabPane);
            }

            return result;
        });
    }

    setupUI();
    setInterval(hookVideo, 2000);
    new MutationObserver(hookVideo).observe(document.body, { childList: true, subtree: true });

    console.log("stashButtplug: Plugin loaded successfully.");
})();
