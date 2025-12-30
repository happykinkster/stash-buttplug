(async function () {
    console.log("stashVR: Loading...");

    // Import three.js from CDN
    let THREE;
    try {
        THREE = await import('https://cdn.jsdelivr.net/npm/three@0.150.0/build/three.module.js');
        console.log("stashVR: Three.js loaded");
    } catch (e) {
        console.error("stashVR: Failed to load Three.js", e);
        return;
    }

    // State
    let xrSession = null;
    let xrRefSpace = null;
    let scene, camera, renderer, videoTexture, sphere;
    let videoEl = null;
    let vrTagName = null;

    // GraphQL helper
    async function gql(query, variables = {}) {
        const response = await fetch('/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, variables })
        });
        const result = await response.json();
        if (result.errors) {
            console.error("stashVR: GraphQL Error", result.errors);
            return null;
        }
        return result.data;
    }

    // Fetch VR tag from settings
    async function fetchVRTag() {
        const data = await gql(`{
            configuration {
                ui {
                    vrTag
                }
            }
        }`);
        if (data && data.configuration && data.configuration.ui) {
            vrTagName = data.configuration.ui.vrTag;
            console.log("stashVR: Settings VR Tag Name:", vrTagName);
        }
    }

    // Setup Three.js scene
    function setupThreeJS() {
        if (!videoEl) return false;
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.xr.enabled = true;
        renderer.autoClear = false;
        videoTexture = new THREE.VideoTexture(videoEl);

        // --- FORCING SBS FOR THIS TEST ---
        const is180 = true;
        const isSBS = true; // We forced this to true to fix the "2 copies" issue

        console.log("stashVR: FORCED 180° SBS MODE");
        let geometry;
        if (is180) {
            // Hemisphere: Start at PI (-X) and cover PI degrees (targeting the -Z half)
            // This flips the video to the other side of the sphere
            geometry = new THREE.SphereGeometry(500, 60, 40, Math.PI, Math.PI);
        } else {
            geometry = new THREE.SphereGeometry(500, 60, 40);
        }

        geometry.scale(-1, 1, 1); // Look from inside
        if (isSBS) {
            // LEFT EYE (Layer 1)
            const leftGeo = geometry.clone();
            const uvs = leftGeo.attributes.uv.array;
            for (let i = 0; i < uvs.length; i += 2) {
                uvs[i] = uvs[i] * 0.5; // Use only the left half of the video
            }
            const leftMesh = new THREE.Mesh(leftGeo, new THREE.MeshBasicMaterial({ map: videoTexture }));
            leftMesh.layers.set(1);
            scene.add(leftMesh);
            // RIGHT EYE (Layer 2)
            const rightGeo = geometry.clone();
            const uvsR = rightGeo.attributes.uv.array;
            for (let i = 0; i < uvsR.length; i += 2) {
                uvsR[i] = uvsR[i] * 0.5 + 0.5; // Use only the right half of the video
            }
            const rightMesh = new THREE.Mesh(rightGeo, new THREE.MeshBasicMaterial({ map: videoTexture }));
            rightMesh.layers.set(2);
            scene.add(rightMesh);

            console.log("stashVR: SBS Layers Active");
        } else {
            const material = new THREE.MeshBasicMaterial({ map: videoTexture });
            const sphere = new THREE.Mesh(geometry, material);
            scene.add(sphere);
        }
        return true;
    }

    // Enter VR
    async function enterVR() {
        if (!navigator.xr || xrSession) return;
        if (!scene && !setupThreeJS()) return;
        try {
            xrSession = await navigator.xr.requestSession("immersive-vr", {
                optionalFeatures: ["local-floor", "bounded-floor"],
            });
            await renderer.xr.setSession(xrSession);

            xrSession.addEventListener("end", () => {
                renderer.setAnimationLoop(null); // STOP the loop on exit
                xrSession = null;
                updateButtonText();
            });
            // The loop now safely checks if we are still in VR
            renderer.setAnimationLoop(() => {
                if (renderer.xr.isPresenting) {
                    renderer.render(scene, camera);
                }
            });
            updateButtonText();
        } catch (error) {
            console.error("stashVR: Error", error);
        }
    }

    // Exit VR
    function exitVR() {
        if (xrSession) {
            xrSession.end();
        }
    }

    // Add VR button to VideoJS controls
    function addVRButton() {
        // Wait for VideoJS control bar
        const controlBar = document.querySelector('.vjs-control-bar');
        if (!controlBar) {
            console.log("stashVR: Control bar not found, retrying...");
            setTimeout(addVRButton, 1000);
            return;
        }

        // Check if button already exists
        if (document.getElementById('vr-button')) {
            return;
        }

        console.log("stashVR: Adding VR button to control bar");

        // Create button
        const btn = document.createElement('button');
        btn.id = 'vr-button';
        btn.className = 'vjs-control vjs-button';
        btn.innerHTML = '🥽 VR';
        btn.style.cursor = 'pointer';
        btn.title = 'Enter VR';

        btn.onclick = () => {
            if (xrSession) {
                exitVR();
            } else {
                enterVR();
            }
        };

        // Add before fullscreen button
        const fullscreenBtn = controlBar.querySelector('.vjs-fullscreen-control');
        if (fullscreenBtn) {
            controlBar.insertBefore(btn, fullscreenBtn);
        } else {
            controlBar.appendChild(btn);
        }

        console.log("stashVR: VR button added");
    }

    // Remove VR button if it exists
    function removeVRButton() {
        const btn = document.getElementById('vr-button');
        if (btn) {
            btn.remove();
            console.log("stashVR: VR button removed");
        }
    }

    function updateButtonText() {
        const btn = document.getElementById('vr-button');
        if (btn) {
            btn.innerHTML = xrSession ? '🥽 Exit VR' : '🥽 VR';
            btn.title = xrSession ? 'Exit VR' : 'Enter VR';
        }
    }

    // Check if current scene has the VR tag
    async function checkSceneTags() {
        if (!vrTagName) return false;

        const match = window.location.pathname.match(/\/scenes\/(\d+)/);
        if (!match) return false;

        const sceneId = match[1];
        const data = await gql(`query FindScene($id: ID!) {
            findScene(id: $id) {
                tags {
                    name
                }
            }
        }`, { id: sceneId });

        if (data && data.findScene && data.findScene.tags) {
            const tags = data.findScene.tags.map(t => t.name.toLowerCase());
            return tags.includes(vrTagName.toLowerCase());
        }
        return false;
    }

    // Hook video element
    async function hookVideo() {
        const v = document.querySelector('video');
        if (v && v !== videoEl) {
            videoEl = v;
            console.log("stashVR: Video element found and hooked");

            // Check if we should show the button
            const shouldShow = await checkSceneTags();
            if (shouldShow) {
                addVRButton();
            } else {
                removeVRButton();
            }
        } else if (v && v === videoEl) {
            // Check again in case tags changed or navigated (though hookVideo is called periodically)
            // But we only want to do GraphQL if the URL id changed or periodically
            // For now, let's keep it simple: if videoEl exists, we might need to remove it if we navigated
            const match = window.location.pathname.match(/\/scenes\/(\d+)/);
            if (!match) {
                removeVRButton();
            }
        }
    }

    // Watch for video element
    setInterval(hookVideo, 2000);

    // Check WebXR support
    if (navigator.xr) {
        navigator.xr.isSessionSupported("immersive-vr").then(async supported => {
            if (supported) {
                console.log("stashVR: WebXR immersive-vr supported!");
                await fetchVRTag();
                hookVideo(); // Try immediately
            } else {
                console.warn("stashVR: WebXR not supported on this device");
            }
        });
    } else {
        console.warn("stashVR: WebXR API not available");
    }

    console.log("stashVR: Plugin loaded successfully");
})();
