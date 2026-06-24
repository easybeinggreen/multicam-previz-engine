// --- OPTICAL & HARDWARE REPLICAS ---
const SENSOR_HEIGHT = 13.8; // mm (Sony F5500 Super35 dimensions)
const SENSOR_WIDTH = 24.6;

// Venue Space Constraints
const STAGE = { width: 29.0, depth: 10.0, height: 6.0 }; // Dimensions in Meters

// Technical Camera Matrix Configuration
const CAMERAS = {
    "CAM 5 (Center Long Lens)": { x: 0, y: 35, z: 1.5, minLens: 25, maxLens: 1000, currentLens: 25 },
    "CAM 12 (Center Ladder)":   { x: 0, y: 12, z: 4.5, minLens: 14, maxLens: 100, currentLens: 14 },
    "CAM 2 (House Right Profile)": { x: -14, y: 20, z: 0.5, minLens: 25, maxLens: 1000, currentLens: 25 },
    "CAM 7 (House Left Profile)":  { x: 14, y: 20, z: 0.5, minLens: 25, maxLens: 1000, currentLens: 25 }
};

// Initial Scene Assembly Array
let stageItems = [
    { id: "actor_1", type: "actor", label: "Lead Actor", x: 0, y: 0, z: 0, w: 0.6, h: 1.8, color: "#00ffcc" },
    { id: "actor_2", type: "actor", label: "Supporting Actor", x: -2.5, y: 1.5, z: 0, w: 0.6, h: 1.65, color: "#ff3366" },
    { id: "table", type: "prop", label: "Table & Flowers", x: 2.0, y: -0.5, z: 0, w: 1.4, h: 0.9, color: "#ffcc00" },
    { id: "bookcase", type: "prop", label: "Bookcase", x: -5.0, y: 3.0, z: 0, w: 1.2, h: 2.4, color: "#9966cc" }
];

let activeCamId = Object.keys(CAMERAS)[0];
let isDragging = false;
let draggedItem = null;

// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
    initUI();
    renderAll();

    // Attach Resize Safety Boundaries
    window.addEventListener('resize', renderAll);
});

function initUI() {
    const selector = document.getElementById('camera-select');
    Object.keys(CAMERAS).forEach(id => {
        let opt = document.createElement('option');
        opt.value = id;
        opt.innerText = id;
        selector.appendChild(opt);
    });

    selector.addEventListener('change', (e) => {
        activeCamId = e.target.value;
        syncSliderLimits();
        renderAll();
    });

    const slider = document.getElementById('focal-slider');
    slider.addEventListener('input', (e) => {
        CAMERAS[activeCamId].currentLens = parseInt(e.target.value);
        document.getElementById('focal-val').innerText = e.target.value + "mm";
        renderAll();
    });

    // Asset Generator Interactivity Hooks
    document.getElementById('btn-add-actor').addEventListener('click', () => addAsset('actor', 0.6, 1.8, '#33ccff'));
    document.getElementById('btn-add-table').addEventListener('click', () => addAsset('prop', 1.4, 0.9, '#ffaa00'));
    document.getElementById('btn-add-bookcase').addEventListener('click', () => addAsset('prop', 1.2, 2.4, '#aa66cc'));

    setupDragging();
    syncSliderLimits();
}

function syncSliderLimits() {
    const cam = CAMERAS[activeCamId];
    const slider = document.getElementById('focal-slider');
    slider.min = cam.minLens;
    slider.max = cam.maxLens;
    slider.value = cam.currentLens;
    document.getElementById('focal-val').innerText = cam.currentLens + "mm";
}

function addAsset(type, w, h, color) {
    const label = type.charAt(0).toUpperCase() + type.slice(1) + " " + (stageItems.length + 1);
    stageItems.push({
        id: "gen_" + Date.now(),
        type: type,
        label: label,
        x: (Math.random() - 0.5) * 6,
        y: (Math.random() - 0.5) * 3,
        z: 0, w: w, h: h, color: color
    });
    renderAll();
}

// --- OPTICAL FRAMEWORK MATH ENGINE ---
function getFOVAngles(focalLength) {
    const hFOV = 2 * Math.atan(SENSOR_WIDTH / (2 * focalLength));
    const vFOV = 2 * Math.atan(SENSOR_HEIGHT / (2 * focalLength));
    return { horizontal: hFOV, vertical: vFOV };
}

// --- RENDER EXECUTION ENGINE ---
function renderAll() {
    drawFloorplan();
    drawViewfinder();
}

// 1. Bird's Eye View Renderer
function drawFloorplan() {
    const canvas = document.getElementById('floorplan-canvas');
    const ctx = canvas.getContext('2d');

    // Fit canvas dynamically
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    ctx.clearRect(0, 0, w, h);

    // Grid Scaling System Transformations (Coordinates centered around downstage center center)
    const scale = 5.5; // Pixels per meter
    const centerX = w / 2;
    const centerY = h / 2 - 20;

    // Convert local stage space coords to canvas viewport pixels
    const toPx = (x, y) => ({ x: centerX + (x * scale), y: centerY - (y * scale) });
    const fromPx = (px, py) => ({ x: (px - centerX) / scale, y: (centerY - py) / scale });

    // Stash transform calculations safely in global space for click metrics
    window.floorplanTransform = { toPx, fromPx };

    // Draw Architectural Proscenium Boundaries
    ctx.fillStyle = "#2d2d2d";
    ctx.fillRect(centerX - (STAGE.width/2)*scale, centerY - (STAGE.depth)*scale, STAGE.width*scale, STAGE.depth*scale);
    ctx.strokeStyle = "#444444";
    ctx.strokeRect(centerX - (STAGE.width/2)*scale, centerY - (STAGE.depth)*scale, STAGE.width*scale, STAGE.depth*scale);

    // Front Lip Target Arc
    ctx.strokeStyle = "#00ffcc";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
    ctx.stroke();

    // Draw Live Spatial Placement Cones
    const activeCam = CAMERAS[activeCamId];
    Object.keys(CAMERAS).forEach(id => {
        const cam = CAMERAS[id];
        const camPos = toPx(cam.x, -cam.y); // Negative adjustments maintain correct orientation

        // Draw Cameras Nodes
        ctx.fillStyle = (id === activeCamId) ? "#00ffcc" : "#888888";
        ctx.beginPath();
        ctx.arc(camPos.x, camPos.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "white";
        ctx.font = "10px monospace";
        ctx.fillText(id.split(' ')[0], camPos.x + 8, camPos.y + 3);

        if (id === activeCamId) {
            // Draw Dynamic Viewing Cones
            const angles = getFOVAngles(cam.currentLens);
            const camAngle = Math.atan2(0 - cam.y, 0 - cam.x); // Looking toward coordinates origin (0,0)

            ctx.fillStyle = "rgba(0, 255, 204, 0.08)";
            ctx.strokeStyle = "rgba(0, 255, 204, 0.4)";
            ctx.beginPath();
            ctx.moveTo(camPos.x, camPos.y);

            const range = 600; // Visual bounds line limit
            ctx.lineTo(camPos.x + Math.cos(camAngle - angles.horizontal/2) * range, camPos.y + Math.sin(camAngle - angles.horizontal/2) * range);
            ctx.lineTo(camPos.x + Math.cos(camAngle + angles.horizontal/2) * range, camPos.y + Math.sin(camAngle + angles.horizontal/2) * range);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }
    });

    // Draw Movable Stage Items
    stageItems.forEach(item => {
        const itemPos = toPx(item.x, item.y);
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.arc(itemPos.x, itemPos.y, item.w * scale * 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "white";
        ctx.lineWidth = (item === draggedItem) ? 2 : 0.5;
        ctx.stroke();
    });
}

// 2. Perspective Projection Engine (Director's Viewfinder)
function drawViewfinder() {
    const canvas = document.getElementById('viewfinder-canvas');
    const ctx = canvas.getContext('2d');

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    ctx.clearRect(0, 0, w, h);

    const cam = CAMERAS[activeCamId];
    const angles = getFOVAngles(cam.currentLens);

    // Compute transformation matrix calculations based on target perspective vector tracking
    // For simplicity and bulletproof execution, project relative to camera line of sight
    const camDistanceToOrigin = Math.hypot(cam.x, cam.y);

    // Sort items by distance from camera to resolve painters sorting rules (depth sorting)
    let sortedItems = stageItems.map(item => {
        const distance = Math.hypot(item.x - cam.x, item.y - cam.y, item.z - cam.z);
        return { ...item, distToCam: distance };
    }).sort((a, b) => b.distToCam - a.distToCam);

    // Tracking scales
    let macroHeightOnScreen = 0;

    sortedItems.forEach(item => {
        // Spatial vectors relative to sensor node orientation
        const dx = item.x - cam.x;
        const dy = item.y - cam.y; 

        // Horizontal angular offsets calculation
        const angleToItem = Math.atan2(dy, dx);
        const angleCamToStage = Math.atan2(0 - cam.y, 0 - cam.x);
        let diffAngleH = angleToItem - angleCamToStage;

        // Normalize radian wraps
        diffAngleH = Math.atan2(Math.sin(diffAngleH), Math.cos(diffAngleH));

        // Geometric physical projection calculations
        const planarDistance = Math.hypot(dx, dy);
        const apparentVerticalAngle = Math.atan2(item.z - cam.z, planarDistance);
        const centerViewVerticalAngle = Math.atan2(0 - cam.z, camDistanceToOrigin);
        const diffAngleV = apparentVerticalAngle - centerViewVerticalAngle;

        // Screen Position Map Coordinate Translation
        const screenX = w / 2 + (diffAngleH / (angles.horizontal / 2)) * (w / 2);
        const screenY = h / 2 - (diffAngleV / (angles.vertical / 2)) * (h / 2);

        // Calculate dynamic height footprint relative to camera metric scaling
        const visibleHeightAtDistance = 2 * planarDistance * Math.tan(angles.vertical / 2);
        const projectedHeight = (item.h / visibleHeightAtDistance) * h;
        const projectedWidth = (item.w / visibleHeightAtDistance) * h;

        if (item.type === "actor" && macroHeightOnScreen === 0) {
            macroHeightOnScreen = (item.h / visibleHeightAtDistance);
        }

        // Draw Element Safely if contained in projection parameters
        if (planarDistance > 1) {
            ctx.fillStyle = item.color;
            ctx.globalAlpha = 0.9;

            // Draw Stylized Silhouettes / Boxes bounding regions
            if (item.type === 'actor') {
                // Actor Profile (Capsule Head & Torso Frame)
                ctx.fillRect(screenX - projectedWidth/2, screenY - projectedHeight, projectedWidth, projectedHeight);
                // Head accent circle
                ctx.fillStyle = "white";
                ctx.beginPath();
                ctx.arc(screenX, screenY - projectedHeight + (projectedWidth/3), projectedWidth/3, 0, Math.PI*2);
                ctx.fill();
            } else {
                // Prop Solid Matrix Blocks
                ctx.fillRect(screenX - projectedWidth/2, screenY - projectedHeight, projectedWidth, projectedHeight);
                ctx.strokeStyle = "rgba(255,255,255,0.5)";
                ctx.strokeRect(screenX - projectedWidth/2, screenY - projectedHeight, projectedWidth, projectedHeight);
            }

            // Text Asset Labels Overlay
            ctx.fillStyle = "white";
            ctx.globalAlpha = 1.0;
            ctx.font = "9px monospace";
            ctx.textAlign = "center";
            ctx.fillText(item.label, screenX, screenY + 12);
        }
    });

    // Refresh HUD Overlay Displays
    document.getElementById('hud-cam').innerText = activeCamId.split(' ')[0];
    document.getElementById('hud-lens').innerText = cam.currentLens + "mm";

    // Categorize Cinematic Scale Labels
    let shotScale = "Extreme Wide Shot (EWS)";
    if (macroHeightOnScreen > 1.2) shotScale = "Extreme Close Up (ECU)";
    else if (macroHeightOnScreen > 0.8) shotScale = "Close Up (CU)";
    else if (macroHeightOnScreen > 0.4) shotScale = "Medium Shot (MS)";
    else if (macroHeightOnScreen > 0.15) shotScale = "Medium Wide (MWS)";

    document.getElementById('hud-scale').innerText = `Lead: ${shotScale}`;
}

// --- INTERACTIVE DRAG & DROP CONTROLS ---
function setupDragging() {
    const canvas = document.getElementById('floorplan-canvas');

    const getMousePos = (e) => {
        const rect = canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    };

    canvas.addEventListener('mousedown', (e) => {
        const m = getMousePos(e);
        if (!window.floorplanTransform) return;

        const worldCoords = window.floorplanTransform.fromPx(m.x, m.y);

        // Detect collision hit markers within physics boundaries
        for (let item of stageItems) {
            const dist = Math.hypot(item.x - worldCoords.x, item.y - worldCoords.y);
            if (dist < item.w * 1.5) { // Match scaled display padding dimensions
                isDragging = true;
                draggedItem = item;
                break;
            }
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!isDragging || !draggedItem) return;
        const m = getMousePos(e);
        const worldCoords = window.floorplanTransform.fromPx(m.x, m.y);

        // Clamp movements inside stage layout boundaries
        draggedItem.x = Math.max(-STAGE.width/2, Math.min(STAGE.width/2, worldCoords.x));
        draggedItem.y = Math.max(0, Math.min(STAGE.depth, worldCoords.y));

        renderAll();
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
        draggedItem = null;
        renderAll();
    });

    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (!window.floorplanTransform) return;

        const m = getMousePos(e);
        const worldCoords = window.floorplanTransform.fromPx(m.x, m.y);

        for (let i = 0; i < stageItems.length; i++) {
            const item = stageItems[i];
            const dist = Math.hypot(item.x - worldCoords.x, item.y - worldCoords.y);
            if (dist < item.w * 1.5) {
                stageItems.splice(i, 1);
                renderAll();
                break;
            }
        }
    });
}