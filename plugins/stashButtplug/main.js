(async function () {
    console.log("stashButtplug: Loading plugin (Simple Mode)...");

    // --- 1. Utility Functions ---
    const MathUtils = {
        clamp01: (x) => Math.min(1, Math.max(0, x)),
        lerp: (a, b, t) => a + (b - a) * Math.min(1, Math.max(0, t)),
        cubicHermite: (x0, y0, x1, y1, s0, s1, x) => {
            let d = x1 - x0;
            let dx = x - x0;
            let t = dx / d;
            let r = 1 - t;
            return r * r * (y0 * (1 + 2 * t) + s0 * dx) + t * t * (y1 * (3 - 2 * t) - d * s1 * r);
        },
        pchipSlopes: (x0, y0, x1, y1, x2, y2, x3, y3) => {
            const hkm1 = x1 - x0;
            const dkm1 = (y1 - y0) / hkm1;
            const hk1 = x2 - x1;
            const dk1 = (y2 - y1) / hk1;
            const w11 = 2 * hk1 + hkm1;
            const w12 = hk1 + 2 * hkm1;
            let s1 = (w11 + w12) / (w11 / dkm1 + w12 / dk1);
            if (!isFinite(s1) || dk1 * dkm1 < 0) s1 = 0;

            const hkm2 = x2 - x1;
            const dkm2 = (y2 - y1) / hkm2;
            const hk2 = x3 - x2;
            const dk2 = (y3 - y2) / hk2;
            const w21 = 2 * hk2 + hkm2;
            const w22 = hk2 + 2 * hkm2;
            let s2 = (w21 + w22) / (w21 / dkm2 + w22 / dk2);
            if (!isFinite(s2) || dk2 * dkm2 < 0) s2 = 0;
            return [s1, s2];
        },
        makimaSlopes: (x0, y0, x1, y1, x2, y2, x3, y3, x4, y4, x5, y5) => {
            const m4 = (y5 - y4) / (x5 - x4);
            const m3 = (y4 - y3) / (x4 - x3);
            const m2 = (y3 - y2) / (x3 - x2);
            const m1 = (y2 - y1) / (x2 - x1);
            const m0 = (y1 - y0) / (x1 - x0);

            const w11 = Math.abs(m3 - m2) + Math.abs(m3 + m2) / 2;
            const w12 = Math.abs(m1 - m0) + Math.abs(m1 + m0) / 2;
            let s1 = (w11 * m1 + w12 * m2) / (w11 + w12);
            if (!isFinite(s1)) s1 = 0;

            const w21 = Math.abs(m4 - m3) + Math.abs(m4 + m3) / 2;
            const w22 = Math.abs(m2 - m1) + Math.abs(m2 + m1) / 2;
            let s2 = (w21 * m2 + w22 * m3) / (w21 + w22);
            if (!isFinite(s2)) s2 = 0;
            return [s1, s2];
        }
    };

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

                // Determine position based on interpolation type
                let pos = this._prevAction.pos;
                const p1 = this._funscript.actions[this._actionIndex]; // target (end of segment)
                const p0 = this._prevAction; // start of segment

                if (p0.at !== p1.at) {
                    const t = convertRange(at, p0.at + this._offset, p1.at + this._offset, 0, 1);
                    const type = (this._interpolationType || "Linear").toLowerCase();

                    if (type === "pchip") {
                        // Need 4 points: p-1, p0, p1, p2
                        const pm1 = this.getAction(this._actionIndex - 1) || { at: p0.at - (p1.at - p0.at), pos: p0.pos }; // naive extrapolate
                        const pp1 = this.getAction(this._actionIndex + 1) || { at: p1.at + (p1.at - p0.at), pos: p1.pos };

                        // Check for extrapolation if index was -1 (start) or out of bounds
                        // A simpler way: just clamp indices in getAction or handle edges.
                        // Impl note: time must be scaled, but Pchip uses actual X/Y. 
                        // To simplify: we Normalize X to 0..1? No, slopes depend on X delta.
                        // Let's use absolute times (scaled by offset?? No, consistent time base).
                        // Actually easier: Use absolute timestamps for calculation.

                        const t0 = p0.at + this._offset;
                        const t1 = p1.at + this._offset;
                        const tm1 = pm1.at + this._offset;
                        const tp1 = pp1.at + this._offset;

                        const slopes = MathUtils.pchipSlopes(tm1, pm1.pos, t0, p0.pos, t1, p1.pos, tp1, pp1.pos);
                        pos = MathUtils.cubicHermite(t0, p0.pos, t1, p1.pos, slopes[0], slopes[1], at);

                    } else if (type === "makima") {
                        // Need 6 points: p-2, p-1, p0, p1, p2, p3
                        const pm1 = this.getAction(this._actionIndex - 1) || { at: p0.at - (p1.at - p0.at), pos: p0.pos };
                        const pm2 = this.getAction(this._actionIndex - 2) || { at: pm1.at - (p0.at - pm1.at), pos: pm1.pos };
                        const pp1 = this.getAction(this._actionIndex + 1) || { at: p1.at + (p1.at - p0.at), pos: p1.pos };
                        const pp2 = this.getAction(this._actionIndex + 2) || { at: pp1.at + (pp1.at - p1.at), pos: pp1.pos };

                        const t0 = p0.at + this._offset;
                        const t1 = p1.at + this._offset;
                        const tm1 = pm1.at + this._offset;
                        const tm2 = pm2.at + this._offset;
                        const tp1 = pp1.at + this._offset;
                        const tp2 = pp2.at + this._offset;

                        const slopes = MathUtils.makimaSlopes(tm2, pm2.pos, tm1, pm1.pos, t0, p0.pos, t1, p1.pos, tp1, pp1.pos, tp2, pp2.pos);
                        pos = MathUtils.cubicHermite(t0, p0.pos, t1, p1.pos, slopes[0], slopes[1], at);
                    } else {
                        // Linear
                        pos = MathUtils.lerp(p0.pos, p1.pos, MathUtils.clamp01(t));
                    }
                }

                if (pos !== this._prevPos) {
                    // We don't integer round here anymore if we want smooth high-res updates, 
                    // but Buttplug might expect 0-1 or 0-100 floats.
                    // The callback handles sending to device.
                    this._posCallback(MathUtils.clamp01(pos / 100) * 100); // Keep 0-100 range
                    this._prevPos = pos;
                }
                this.runLoop();
            }, 1000 / this._hzRate);
        }

        getAction(index) {
            // _actionIndex points to the TARGET action (the one we are approaching).
            // But in my advanceKeyframes logic: _prevAction is current start, actions[_actionIndex] is target.
            // So if _actionIndex is 5, we are between 4 and 5.
            // helper to safe get from array
            if (!this._funscript || !this._funscript.actions) return null;
            // _actionIndex is the index of 'p1' (end of segment).
            // So 'p0' (start of segment) effectively was at index-1 (but we cached it in _prevAction).
            // If we really want neighbour access, we should trust the array.
            // But wait, _prevAction might be a synthetic start-point (at=0, pos=50) not in the array.
            // If index < 0, it's weird.

            // Let's rely on array access relative to _actionIndex.
            // index param here is relative to the actions array.
            const i = this._actionIndex + (index - this._actionIndex); // Just use index directly?

            // Map relative offset to array index? 
            // Logic in Pchip: getAction(_actionIndex - 1) means the one BEFORE p0.
            // p1 is at _actionIndex. p0 is at _actionIndex - 1.
            // So p-1 is at _actionIndex - 2.

            // Wait, let's redefine:
            // p1 = actions[_actionIndex]
            // p0 = actions[_actionIndex - 1] (usually).

            // If _prevAction was generated (startPos), it might not match actions[_actionIndex-1].
            // But for Pchip/Makima we really need geometric continuity, so using the array is safer.
            // If we are at very start, we extrapolate.

            // Let's make getAction(offset) where 0 is p1 (current target), -1 is p0, -2 is p-1 etc.
            const realIndex = this._actionIndex + index; // Wait, calling logic passed absolute indices?
            // No, my calling logic above: getAction(this._actionIndex - 1). This implies absolute index.

            if (index < 0 || index >= this._funscript.actions.length) return null;
            return this._funscript.actions[index];
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
                    if (this._config.interpolationType) {
                        this._funscriptPlayer._interpolationType = this._config.interpolationType;
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
            this._lastSentPos = null;
            this._lastSentTime = null;
        }

        async sendToDevice(pos) {
            if (!this._client || !this._client.connected) return;
            let finalPos = Number(pos) / 100;

            // 0. Intensity (Gain)
            if (this._config.intensity && this._config.intensity !== 1.0) {
                finalPos = MathUtils.clamp01(finalPos * Number(this._config.intensity));
            }

            const now = Date.now();

            // 1. Speed Limiter
            if (this._config.enableSpeedLimit && this._lastSentPos !== null && this._lastSentTime !== null) {
                const dt = (now - this._lastSentTime) / 1000;
                if (dt > 0) {
                    const maxStep = (Number(this._config.speedLimitCount) || 100) / 100 * dt; // units per second (0-1 scaled)
                    const diff = finalPos - this._lastSentPos;
                    if (Math.abs(diff) > maxStep) {
                        finalPos = this._lastSentPos + Math.sign(diff) * maxStep;
                    }
                }
            }

            // 2. Dirty Check (Optimized) - Only send if changed > 0.5% (0.005)
            // Or if we haven't sent in a while? No, dirty check is enough.
            if (this._lastSentPos !== null && Math.abs(finalPos - this._lastSentPos) < 0.005) {
                return;
            }

            this._lastSentPos = finalPos;
            this._lastSentTime = now;

            for (const device of this._client.devices) {
                try {
                    if (device.vibrateAttributes?.length > 0) {
                        await device.vibrate(finalPos).catch(() => { });
                    }
                    if (device.linearAttributes?.length > 0) {
                        const duration = Math.round(1000 / (this._config.updateRate || 20));
                        await device.linear(finalPos, duration).catch(() => { });
                    }
                    if (device.rotateAttributes?.length > 0) {
                        await device.rotate(finalPos, true).catch(() => { });
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
