(async function () {
    console.log("stashButtplug: Loading plugin (Simple Mode)...");

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

        play(at = 0) {
            if (!this._funscript || !this._funscript.actions) return;
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
            if (!this._funscript || !this._funscript.actions) return false;
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
            this._config = {
                serverUrl: "ws://localhost:12345",
                latency: 0,
                autoConnect: false,
                updateRate: 20
            };
        }

        async fetchSettings() {
            try {
                const query = { query: "{ configuration { plugins } }" };
                const res = await fetch("/graphql", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(query)
                });
                const data = await res.json();
                const settings = data?.data?.configuration?.plugins?.stashButtplug;
                if (settings) {
                    console.log("stashButtplug: Settings fetched from Stash", settings);
                    const oldUrl = this._config.serverUrl;
                    this._config = { ...this._config, ...settings };
                    if (this._config.serverUrl !== oldUrl) {
                        await this.disconnect();
                        this._connector = null;
                    }
                    if (this._config.updateRate) {
                        this._funscriptPlayer._hzRate = Number(this._config.updateRate);
                    }
                }
            } catch (e) { console.error("stashButtplug: Failed to fetch settings", e); }
        }

        async initButtplug() {
            if (this._ButtplugDocs) return;
            try {
                this._ButtplugDocs = await import('https://cdn.jsdelivr.net/npm/buttplug@3.2.2/dist/web/buttplug.mjs');
                const { ButtplugClient } = this._ButtplugDocs;
                this._client = new ButtplugClient("Stash Plugin");
            } catch (e) { console.error("stashButtplug: Library load failure", e); }
        }

        async connect() {
            await this.fetchSettings();
            await this.initButtplug();
            if (!this._client || this._client.connected) return;

            const isHttps = window.location.protocol === "https:";
            const isWs = this._config.serverUrl.startsWith("ws://");

            if (isHttps && isWs) {
                console.warn("stashButtplug: Mixed Content Detected! Browsers block ws:// connections from https:// pages.");
                console.warn("Try using http:// to access Stash, or use a wss:// connection if your Intiface/Buttplug server supports it.");
            }

            const { ButtplugBrowserWebsocketClientConnector } = this._ButtplugDocs;
            this._connector = new ButtplugBrowserWebsocketClientConnector(this._config.serverUrl);

            try {
                await this._client.connect(this._connector);
                console.log("stashButtplug: Connected to " + this._config.serverUrl);
                await this._client.startScanning().catch(() => { });
                setTimeout(() => {
                    if (this._client?.connected) this._client.stopScanning().catch(() => { });
                }, 5000);
            } catch (e) {
                console.error("stashButtplug: Connection failed.", e);
                if (e && e.message) console.error("Error message:", e.message);
                if (isHttps && isWs) {
                    console.error("This failure is almost certainly due to HTTPS blocking a ws:// connection (Mixed Content).");
                }
            }
        }

        async disconnect() {
            if (this._client?.connected) {
                await this._client.disconnect().catch(() => { });
            }
        }

        async sendToDevice(pos) {
            if (!this._client || !this._client.connected) return;
            const position = Number(pos) / 100;

            for (const device of this._client.devices) {
                try {
                    if (device.vibrateAttributes?.length > 0) {
                        await device.vibrate(position).catch(() => { });
                    }
                    if (device.linearAttributes?.length > 0) {
                        const duration = Math.round(1000 / (this._config.updateRate || 20));
                        await device.linear(position, duration).catch(() => { });
                    }
                    if (device.rotateAttributes?.length > 0) {
                        await device.rotate(position, true).catch(() => { });
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
            if (this._config.autoConnect && (!this._client || !this._client.connected)) {
                await this.connect();
            }
            this._funscriptPlayer._offset = -Number(this._config.latency || 0);
            this._funscriptPlayer.play(Math.trunc(Number(at) * 1000));
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
            this._funscriptPlayer.playSync(Math.trunc(Number(at) * 1000));
        }
    }

    const manager = new ButtplugInteractive();

    // --- 4. Video lifecycle ---
    let currentVideo = null;
    function hookVideo() {
        const v = document.querySelector('video');
        if (v && v !== currentVideo) {
            currentVideo = v;
            const id = window.location.pathname.match(/\/scenes\/(\d+)/)?.[1];
            if (id) manager.uploadScript(`/scene/${id}/funscript`);
            v.onplaying = () => manager.play(v.currentTime);
            v.onpause = () => manager.pause();
            v.ontimeupdate = () => manager.sync(v.currentTime);
            v.onseeked = () => { manager.pause(); manager.play(v.currentTime); };
        }
    }

    // Initial fetch
    await manager.fetchSettings();

    setInterval(hookVideo, 2000);
    const observer = new MutationObserver(hookVideo);
    observer.observe(document.body, { childList: true, subtree: true });

    console.log("stashButtplug: Plugin fully initialized (Simple GraphQL Mode).");
})();
