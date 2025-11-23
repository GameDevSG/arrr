const plantInfo = {
    Ahwagandha: {
        name: "Ashwagandha",
        info: "Ashwagandha is an ancient medicinal herb. It's classified as an adaptogen, meaning it can help your body manage stress."
    },
    Cardamom: {
        name: "Cardamom",
        info: "Cardamom is known for its strong aroma and is commonly used in traditional medicine for digestive issues and oral health."
    },
    Cinnamon: {
        name: "Cinnamon",
        info: "Cinnamon is loaded with antioxidants and has anti-inflammatory properties. It can help regulate blood sugar levels."
    },
    clove: {
        name: "Clove",
        info: "Cloves contain powerful antioxidants and have antibacterial properties. They're traditionally used for dental pain and digestive issues."
    },
    tulsi: {
        name: "Tulsi (Holy Basil)",
        info: "Tulsi is considered a sacred plant in Ayurveda. It has adaptogenic properties and helps combat stress and boost immunity."
    },
    Turmeric: {
        name: "Turmeric",
        info: "Turmeric contains curcumin, a powerful anti-inflammatory compound. It's known for its antioxidant properties and potential health benefits."
    }
};

function initAR() {
    const plantSelector = document.getElementById('plantSelector');
    const infoCard = document.getElementById('plantInfo');
    const debugMsg = document.getElementById('debug-message');
    const statusIcon = document.getElementById('status-icon');
    const canvas = document.getElementById('xr-canvas');

    if (!plantSelector || !debugMsg || !statusIcon || !canvas) {
        console.error('Missing DOM elements');
        return;
    }

    let selectedPlant = null;
    let placedModels = [];
    let gltfLoader = new THREE.GLTFLoader();
    let renderer, scene, camera;
    let xrSession = null;
    let xrRefSpace = null;
    let xrHitTestSource = null;
    let lastHitMatrix = null;
    let surfaceDetected = false;

    function showDebug(msg) {
        debugMsg.textContent = msg;
        console.log(msg);
    }

    function setStatusIcon(state) {
        statusIcon.className = 'status-icon';
        if (state === 'yes') {
            statusIcon.textContent = '✔';
            statusIcon.classList.add('status-yes');
        } else if (state === 'no') {
            statusIcon.textContent = '✖';
            statusIcon.classList.add('status-no');
        } else {
            statusIcon.textContent = '?';
            statusIcon.classList.add('status-unknown');
        }
    }

    function updatePlantInfo(plantKey) {
        if (!infoCard) return;
        if (plantInfo[plantKey]) {
            infoCard.innerHTML = `<h2>${plantInfo[plantKey].name}</h2><p>${plantInfo[plantKey].info}</p>`;
            infoCard.classList.add('visible');
        } else {
            infoCard.classList.remove('visible');
        }
    }

    plantSelector.addEventListener('change', (e) => {
        selectedPlant = e.target.value;
        updatePlantInfo(selectedPlant);
        showDebug(selectedPlant ? `Selected: ${selectedPlant}` : 'No plant selected');
    });

    function initThree() {
        renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.xr.enabled = true;

        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

        const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(1, 2, 3);
        scene.add(directionalLight);

        showDebug('Tap screen to start AR');
    }

    function loadPlantModel(plantKey, callback) {
        if (!plantKey) {
            callback(null);
            return;
        }
        const modelPath = `models/${plantKey}.glb`;
        gltfLoader.load(
            modelPath,
            (gltf) => {
                const model = gltf.scene;
                model.scale.set(1, 1, 1);
                callback(model);
            },
            undefined,
            (err) => {
                showDebug(`ERROR loading ${plantKey}: check models/ folder`);
                console.error(err);
                callback(null);
            }
        );
    }

    async function startARSession() {
        if (!navigator.xr) {
            showDebug('WebXR not supported');
            setStatusIcon('no');
            return;
        }

        try {
            const session = await navigator.xr.requestSession('immersive-ar', {
                requiredFeatures: ['hit-test', 'dom-overlay'],
                domOverlay: { root: document.body }
            });

            xrSession = session;
            renderer.xr.setSession(session);

            xrRefSpace = await session.requestReferenceSpace('viewer');
            xrHitTestSource = await session.requestHitTestSource({ space: xrRefSpace });

            showDebug('AR active. Point at flat surface.');
            setStatusIcon('unknown');

            session.addEventListener('select', onXRSelect);
            session.addEventListener('end', () => {
                xrSession = null;
                showDebug('AR ended');
                setStatusIcon('unknown');
            });

            renderer.setAnimationLoop((time, frame) => renderARFrame(time, frame));
        } catch (err) {
            showDebug(`AR failed: ${err.message}`);
            console.error(err);
            setStatusIcon('no');
        }
    }

    function onXRSelect() {
        if (!selectedPlant) {
            showDebug('Select a plant first!');
            return;
        }
        if (!lastHitMatrix) {
            showDebug('No surface. Move camera.');
            return;
        }

        loadPlantModel(selectedPlant, (model) => {
            if (!model) return;

            model.matrixAutoUpdate = false;
            model.matrix.fromArray(lastHitMatrix);
            scene.add(model);
            placedModels.push(model);
            showDebug(`✓ Placed ${plantInfo[selectedPlant].name}`);
        });
    }

    function renderARFrame(time, frame) {
        if (!frame) {
            renderer.render(scene, camera);
            return;
        }

        const hitTestResults = frame.getHitTestResults(xrHitTestSource);
        if (hitTestResults.length > 0) {
            const hit = hitTestResults[0];
            const pose = hit.getPose(xrRefSpace);
            if (pose) {
                lastHitMatrix = pose.transform.matrix;
                if (!surfaceDetected) {
                    showDebug('✓ Surface detected. Tap to place.');
                    setStatusIcon('yes');
                    surfaceDetected = true;
                }
            }
        } else {
            lastHitMatrix = null;
            if (surfaceDetected) {
                showDebug('✗ No surface. Scan area.');
                setStatusIcon('no');
                surfaceDetected = false;
            }
        }

        renderer.render(scene, camera);
    }

    canvas.addEventListener('click', () => {
        if (!xrSession) {
            startARSession();
        }
    });

    window.addEventListener('resize', () => {
        if (camera && renderer) {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        }
    });

    try {
        initThree();
        setStatusIcon('unknown');
    } catch (err) {
        console.error('Init error:', err);
        showDebug(`Error: ${err.message}`);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(initAR, 100));
} else {
    setTimeout(initAR, 100);
}
