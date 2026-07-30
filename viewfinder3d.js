// ===== Final 3D viewer with audience, stage, and compact HUD =====
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

function worldToThree(x, y, z) { return new THREE.Vector3(x, z, -y); }

async function init3D() {
  const canvas3d = document.getElementById('vf3d');
  const toggle = document.getElementById('use3d');
  const canvas2d = document.getElementById('vf');
  if (!canvas3d || !toggle) return;

  const renderer = new THREE.WebGLRenderer({ canvas: canvas3d, antialias: true });
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  const state = window.PrevizState;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf5f0eb);

  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 200);

  // ---- Lighting ----
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const mainLight = new THREE.DirectionalLight(0xffeedd, 1.5);
  mainLight.position.set(10, 15, 10);
  mainLight.castShadow = true;
  mainLight.shadow.mapSize.set(2048, 2048);
  mainLight.shadow.camera.left = -20;
  mainLight.shadow.camera.right = 20;
  mainLight.shadow.camera.top = 20;
  mainLight.shadow.camera.bottom = -20;
  scene.add(mainLight);
  const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3);
  fillLight.position.set(-10, 5, -10);
  scene.add(fillLight);
  const rimLight = new THREE.DirectionalLight(0xffffff, 0.2);
  rimLight.position.set(0, 10, -20);
  scene.add(rimLight);

  const roomCenter3D = worldToThree(state.ROOM_CENTER.x, state.ROOM_CENTER.y, 0);

  // ---- Stage floor (ring) – increased segments, rotated to hide seam ----
  const stageRingGeo = new THREE.RingGeometry(state.R_AUDIENCE, state.R_WALL, 128);
  const stageRingMat = new THREE.MeshStandardMaterial({
    color: 0xb8b4ac,
    roughness: 0.7,
    metalness: 0.1,
    side: THREE.DoubleSide,
  });
  const stageRing = new THREE.Mesh(stageRingGeo, stageRingMat);
  stageRing.rotation.x = -Math.PI / 2;
  stageRing.rotation.z = Math.PI / 128; // slight rotation to hide seam
  stageRing.position.copy(roomCenter3D);
  stageRing.receiveShadow = true;
  scene.add(stageRing);

  // ---- Audience floor ----
  const audienceFloorPos = worldToThree(state.ROOM_CENTER.x, state.ROOM_CENTER.y, state.audienceFloorZ);
  const floorGeo = new THREE.CircleGeometry(state.R_AUDIENCE, 64);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x999999,
    roughness: 0.8,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const audienceFloor = new THREE.Mesh(floorGeo, floorMat);
  audienceFloor.rotation.x = -Math.PI / 2;
  audienceFloor.position.copy(audienceFloorPos);
  audienceFloor.receiveShadow = true;
  scene.add(audienceFloor);

  // ---- Step wall ----
  const wallHeight = 1.14;
  const wallGeo = new THREE.CylinderGeometry(state.R_AUDIENCE, state.R_AUDIENCE, wallHeight, 128, 1, true);
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x888888,
    roughness: 0.6,
    metalness: 0.2,
    side: THREE.DoubleSide,
  });
  const stepWall = new THREE.Mesh(wallGeo, wallMat);
  const wallPos = worldToThree(state.ROOM_CENTER.x, state.ROOM_CENTER.y, -wallHeight/2);
  stepWall.position.copy(wallPos);
  stepWall.receiveShadow = true;
  scene.add(stepWall);

  // ---- Seating positions (same as before) ----
  function getSeatPositions() {
    const positions = [];
    const { R_AUDIENCE, ROOM_CENTER, leftWalkwayLeft, leftWalkwayRight, rightWalkwayLeft, rightWalkwayRight, cutY, seatWidth, seatDepth } = state;
    const centreY = ROOM_CENTER.y;
    const radius = R_AUDIENCE;
    const backY = centreY - radius;
    let y = backY;
    while (y <= cutY) {
      const dy = y - centreY;
      const r2 = radius * radius - dy * dy;
      if (r2 <= 0) { y += seatDepth; continue; }
      const xCirc = Math.sqrt(r2);
      const leftBound = -xCirc;
      const rightBound = xCirc;

      const leftBlockStart = leftBound;
      const leftBlockEnd = leftWalkwayLeft;
      const centreBlockStart = leftWalkwayRight;
      const centreBlockEnd = rightWalkwayLeft;
      const rightBlockStart = rightWalkwayRight;
      const rightBlockEnd = rightBound;

      function addBlock(start, end, yPos) {
        if (end <= start) return;
        const width = end - start;
        const numSeats = Math.floor(width / seatWidth);
        if (numSeats <= 0) return;
        const seatW = width / numSeats;
        for (let s = 0; s < numSeats; s++) {
          const x = start + s * seatW + seatW * 0.08;
          positions.push({ x, y: yPos });
        }
      }

      addBlock(leftBlockStart, leftBlockEnd, y);
      addBlock(centreBlockStart, centreBlockEnd, y);
      addBlock(rightBlockStart, rightBlockEnd, y);

      y += seatDepth;
    }
    return positions;
  }

  const seatPositions = getSeatPositions();
  console.log(`Creating ${seatPositions.length} seats in 3D`);

  const seatGroup = new THREE.Group();
  const seatMat = new THREE.MeshStandardMaterial({ color: 0xb0b0b0, roughness: 0.6 });
  const seatGeo = new THREE.BoxGeometry(state.seatWidth * 0.8, 0.1, state.seatDepth * 0.7);
  seatPositions.forEach(pos => {
    const seat = new THREE.Mesh(seatGeo, seatMat);
    const threePos = worldToThree(pos.x, pos.y, state.audienceFloorZ + 0.05);
    seat.position.copy(threePos);
    const dx = 0 - pos.x;
    const dy = ROOM_CENTER.y - pos.y;
    const angle = Math.atan2(dy, dx);
    seat.rotation.y = -angle;
    seat.castShadow = true;
    seat.receiveShadow = true;
    seatGroup.add(seat);
  });
  scene.add(seatGroup);

  // ---- Vignette recesses: real 3D volumes ----
  // Each vignette is a rectangular recess (side walls + back wall + floor) touching its neighbour
  // only at the front (mouth) corner, with a wedge-shaped wall cap closing the gap behind that
  // point. A separate flush panel sits above (10ft–20ft), level with the mouth, not recessed.

  function quadGeometry(p1, p2, p3, p4) {
    // p1..p4 wound around the quad perimeter (THREE.Vector3 in three.js world space)
    const geo = new THREE.BufferGeometry();
    const verts = new Float32Array([
      p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z,
      p1.x, p1.y, p1.z, p3.x, p3.y, p3.z, p4.x, p4.y, p4.z
    ]);
    const uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]);
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.computeVertexNormals();
    return geo;
  }

  function triGeometry(p1, p2, p3) {
    const geo = new THREE.BufferGeometry();
    const verts = new Float32Array([p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z]);
    const uvs = new Float32Array([0, 0, 1, 0, 0.5, 1]);
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.computeVertexNormals();
    return geo;
  }

  const neutralWallMat = new THREE.MeshStandardMaterial({
    color: 0xe8e4df, roughness: 0.75, metalness: 0.05, side: THREE.DoubleSide
  });
  const recessFloorMat = new THREE.MeshStandardMaterial({
    color: 0xd8d4cd, roughness: 0.8, metalness: 0.0, side: THREE.DoubleSide
  });
  // Dedicated dark/matte material for roof + wedge-cap undersides — these were reusing the
  // bright wall material, which read as an odd flat-lit slab from above/behind. A darker,
  // shadow-toned ceiling recedes visually instead of popping forward.
  const ceilingMat = new THREE.MeshStandardMaterial({
    color: 0x3f3b34, roughness: 0.95, metalness: 0.0, side: THREE.DoubleSide
  });

  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return { r: parseInt(h.substr(0, 2), 16), g: parseInt(h.substr(2, 2), 16), b: parseInt(h.substr(4, 2), 16) };
  }
  function lerpColor(hexDark, hexLight, t) {
    const a = hexToRgb(hexDark), b = hexToRgb(hexLight);
    const r = Math.round(a.r + (b.r - a.r) * t);
    const g = Math.round(a.g + (b.g - a.g) * t);
    const bl = Math.round(a.b + (b.b - a.b) * t);
    return `rgb(${r},${g},${bl})`;
  }

  // ---- Procedural backdrop textures — approximations of each vignette's distinct look, not
  // reproductions of the actual set art (which we don't have at any usable resolution) ----
  function makeCanvas() {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 512;
    return c;
  }

  function textureV1(ctx, w, h, dark, light) {
    // Jagged rock / canyon linework
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, light); grad.addColorStop(1, dark);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    for (let i = 0; i < 26; i++) {
      let y = Math.random() * h;
      ctx.lineWidth = 1 + Math.random() * 2;
      ctx.beginPath(); ctx.moveTo(0, y);
      for (let x = 0; x <= w; x += w / 24) { y += (Math.random() - 0.5) * h * 0.12; ctx.lineTo(x, y); }
      ctx.stroke();
    }
  }

  function textureV2(ctx, w, h, dark, light) {
    // Organic branching / coral weave
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, light); grad.addColorStop(1, dark);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    function branch(x, y, angle, len, depth) {
      if (depth <= 0 || len < 4) return;
      const x2 = x + Math.cos(angle) * len, y2 = y + Math.sin(angle) * len;
      ctx.lineWidth = Math.max(0.6, depth * 0.5);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
      const spread = 0.5 + Math.random() * 0.4;
      branch(x2, y2, angle - spread, len * 0.72, depth - 1);
      branch(x2, y2, angle + spread, len * 0.72, depth - 1);
    }
    for (let i = 0; i < 6; i++) branch((i + 0.5) * (w / 6), h, -Math.PI / 2 + (Math.random() - 0.5) * 0.6, h * 0.32, 7);
  }

  function textureV3(ctx, w, h, dark, light) {
    // Terraced mountain ridges — bands interpolate from dark (back) to light (front)
    ctx.fillStyle = dark; ctx.fillRect(0, 0, w, h);
    const bands = 6;
    for (let b = 0; b < bands; b++) {
      const baseY = h * (0.25 + b * (0.7 / bands));
      ctx.beginPath(); ctx.moveTo(0, h);
      let y = baseY;
      for (let x = 0; x <= w; x += w / 40) { y += (Math.random() - 0.5) * 14; ctx.lineTo(x, y); }
      ctx.lineTo(w, h); ctx.closePath();
      ctx.fillStyle = lerpColor(dark, light, b / (bands - 1));
      ctx.fill();
    }
  }

  function textureV4(ctx, w, h, dark, light) {
    // Angular staircase — steps interpolate from dark (back) to light (front)
    ctx.fillStyle = dark; ctx.fillRect(0, 0, w, h);
    const steps = 10;
    for (let i = 0; i < steps; i++) {
      const x0 = (i / steps) * w;
      const stepH = (i / steps) * h * 0.7;
      ctx.fillStyle = lerpColor(dark, light, i / (steps - 1));
      ctx.fillRect(x0, h - stepH, w / steps + 1, stepH);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.strokeRect(x0, h - stepH, w / steps + 1, stepH);
    }
  }

  function textureV5(ctx, w, h, dark, light) {
    // Elliptical "planet" swirl
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, light); grad.addColorStop(1, dark);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    for (let r = 20; r < Math.max(w, h); r += 22) {
      ctx.lineWidth = 1 + (r % 66 === 0 ? 1 : 0);
      ctx.beginPath(); ctx.ellipse(cx, cy, r * 1.15, r * 0.55, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }

  const TEXTURE_FNS = { V1: textureV1, V2: textureV2, V3: textureV3, V4: textureV4, V5: textureV5 };
  function makeVignetteTexture(name) {
    const canvas = makeCanvas();
    const ctx = canvas.getContext('2d');
    const dark = state.VIGNETTE_DARK_COLORS[name] || '#333333';
    const light = state.VIGNETTE_COLORS[name] || '#cccccc';
    (TEXTURE_FNS[name] || textureV1)(ctx, canvas.width, canvas.height, dark, light);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  const LOWER_H = state.VIGNETTE_LOWER_H, TOTAL_H = state.VIGNETTE_TOTAL_H;

  state.VIGNETTE_ORDER.forEach(name => {
    const fp = state.VIGNETTE_FOOTPRINTS[name];
    const w3 = (p, z) => worldToThree(p.x, p.y, z);

    const frontL0 = w3(fp.frontL, 0), frontR0 = w3(fp.frontR, 0);
    const backL0 = w3(fp.backL, 0), backR0 = w3(fp.backR, 0);
    const frontLh = w3(fp.frontL, LOWER_H), frontRh = w3(fp.frontR, LOWER_H);
    const backLh = w3(fp.backL, LOWER_H), backRh = w3(fp.backR, LOWER_H);
    const frontLtop = w3(fp.frontL, TOTAL_H), frontRtop = w3(fp.frontR, TOTAL_H);

    // Back wall — unique texture per vignette
    const backMat = new THREE.MeshStandardMaterial({
      map: makeVignetteTexture(name), roughness: 0.85, metalness: 0.0, side: THREE.DoubleSide
    });
    const backWall = new THREE.Mesh(quadGeometry(backL0, backR0, backRh, backLh), backMat);
    backWall.receiveShadow = true;
    scene.add(backWall);

    // Side walls
    const sideL = new THREE.Mesh(quadGeometry(frontL0, backL0, backLh, frontLh), neutralWallMat);
    const sideR = new THREE.Mesh(quadGeometry(backR0, frontR0, frontRh, backRh), neutralWallMat);
    sideL.receiveShadow = true; sideR.receiveShadow = true;
    scene.add(sideL); scene.add(sideR);

    // Recess floor
    const floor = new THREE.Mesh(quadGeometry(frontL0, frontR0, backR0, backL0), recessFloorMat);
    floor.receiveShadow = true;
    scene.add(floor);

    // Upper flush panel (10ft–20ft) — sits at the mouth, not recessed
    const upperPanel = new THREE.Mesh(quadGeometry(frontLh, frontRh, frontRtop, frontLtop), neutralWallMat);
    upperPanel.receiveShadow = true;
    scene.add(upperPanel);

    // Roof — closes the top of the actual recessed box (was wrongly capping the top of the
    // WHOLE structure at TOTAL_H, leaving the recess itself open — you'd sightline straight
    // through to the backside of the light-colored upper panel, which is why it stayed white
    // no matter what material the roof had)
    const roof = new THREE.Mesh(quadGeometry(backLh, backRh, frontRh, frontLh), ceilingMat);
    roof.receiveShadow = true;
    scene.add(roof);
  });

  // Wedge caps: close the solid-wall gap between neighbouring recesses' back walls
  for (let i = 0; i < state.VIGNETTE_ORDER.length - 1; i++) {
    const a = state.VIGNETTE_FOOTPRINTS[state.VIGNETTE_ORDER[i]];
    const b = state.VIGNETTE_FOOTPRINTS[state.VIGNETTE_ORDER[i + 1]];
    const w3 = (p, z) => worldToThree(p.x, p.y, z);
    const p1 = w3(a.backR, 0), p2 = w3(b.backL, 0);
    const p1h = w3(a.backR, LOWER_H), p2h = w3(b.backL, LOWER_H);
    const shared = w3(a.frontR, LOWER_H); // == b.frontL, the touching corner
    const wedge = new THREE.Mesh(quadGeometry(p1, p2, p2h, p1h), neutralWallMat);
    wedge.receiveShadow = true;
    scene.add(wedge);
    // Wedge roof (closes the top of the gap — above LOWER_H the upper flush panels
    // already join seamlessly, so only this lower triangular volume needs capping)
    const wedgeRoof = new THREE.Mesh(triGeometry(p1h, p2h, shared), ceilingMat);
    wedgeRoof.receiveShadow = true;
    scene.add(wedgeRoof);
  }

  // ---- Character model loading ----
  // 👈 ADDED ELIZABETH URL
  const MODEL_URLS = {
    brian: './Brian_Upright.glb',
    elizabeth: './Elizabeth_Upright.glb'
  };
  const templateCache = new Map();

  async function loadCharacterTemplate(modelKey) {
    const url = MODEL_URLS[modelKey] || MODEL_URLS.brian;
    const loader = new GLTFLoader();
    console.log(`🔄 Loading character "${modelKey}" from:`, url);
    try {
      const gltf = await loader.loadAsync(url);
      const root = new THREE.Group();
      root.name = 'CharacterRoot';
      root.add(gltf.scene);

      const box = new THREE.Box3().setFromObject(root);
      const size = new THREE.Vector3();
      box.getSize(size);
      const rawHeight = size.y > 0.001 ? size.y : 1;
      console.log(`📦 "${modelKey}" raw height (Y):`, rawHeight);

      root.traverse((child) => {
        if (child.isMesh) {
          child.material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.55,
            metalness: 0.0,
            emissive: new THREE.Color(0x151515),
          });
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      console.log(`✅ "${modelKey}" template ready (whiter)`);
      return { root, rawHeight };
    } catch (err) {
      console.error(`❌ "${modelKey}" load failed:`, err);
      return null;
    }
  }

  async function getTemplate(modelKey) {
    if (!templateCache.has(modelKey)) {
      templateCache.set(modelKey, await loadCharacterTemplate(modelKey));
    }
    return templateCache.get(modelKey);
  }

  function makeActorMesh(template, desiredHeight) {
    const placement = new THREE.Group();
    placement.userData = { isCharacter: true };
    if (template) {
      const model = template.root.clone(true);
      const scale = desiredHeight / template.rawHeight;
      model.scale.set(scale, scale, scale);
      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model);
      model.position.y = -box.min.y;
      placement.add(model);
    } else {
      const geo = new THREE.BoxGeometry(0.6, desiredHeight, 0.4);
      const mat = new THREE.MeshStandardMaterial({ color: 0x8888ff });
      const box = new THREE.Mesh(geo, mat);
      box.castShadow = true;
      box.receiveShadow = true;
      box.position.y = desiredHeight / 2;
      placement.add(box);
    }
    return placement;
  }

  await Promise.all(
    [...new Set(state.items.filter(i => i.type === 'actor').map(i => i.modelKey || 'brian'))]
      .map(getTemplate)
  );

  const actorMeshes = new Map();
  const propMeshes = new Map();

  function syncItems() {
    const liveIds = new Set(state.items.map(i => i.id));
    actorMeshes.forEach((mesh, id) => {
      if (!liveIds.has(id)) { scene.remove(mesh); actorMeshes.delete(id); }
    });
    propMeshes.forEach((mesh, id) => {
      if (!liveIds.has(id)) { scene.remove(mesh); propMeshes.delete(id); }
    });

    state.items.forEach(it => {
      if (it.type === 'actor') {
        let actorGroup = actorMeshes.get(it.id);
        if (!actorGroup) {
          const modelKey = it.modelKey || 'brian';
          // 👈 MODEL-SPECIFIC DEFAULT HEIGHT: Elizabeth = 1.7m, Brian = 1.8m
          const defaultHeight = (modelKey === 'elizabeth') ? 1.7 : 1.8;
          const desiredHeight = it.h || defaultHeight;
          const template = templateCache.get(modelKey) || null;
          actorGroup = makeActorMesh(template, desiredHeight);
          actorGroup.userData.actorId = it.id;
          scene.add(actorGroup);
          actorMeshes.set(it.id, actorGroup);
          if (!templateCache.has(modelKey)) {
            getTemplate(modelKey).then(tmpl => {
              const stillPresent = actorMeshes.get(it.id) === actorGroup;
              if (tmpl && stillPresent) {
                const rebuilt = makeActorMesh(tmpl, desiredHeight);
                rebuilt.userData.actorId = it.id;
                rebuilt.position.copy(actorGroup.position);
                rebuilt.rotation.copy(actorGroup.rotation);
                scene.remove(actorGroup);
                scene.add(rebuilt);
                actorMeshes.set(it.id, rebuilt);
              }
            });
          }
        }
        actorGroup.position.copy(worldToThree(it.x, it.y, 0));
        const facingRad = it.facing * state.D2R;
        actorGroup.rotation.y = -facingRad - Math.PI / 2;
        actorGroup.updateMatrixWorld(true);
      } else {
        let m = propMeshes.get(it.id);
        if (!m) {
          const geo = new THREE.BoxGeometry(it.w, it.h, it.d || it.w);
          const mat = new THREE.MeshStandardMaterial({ color: it.color, roughness: 0.7 });
          m = new THREE.Mesh(geo, mat);
          m.castShadow = true;
          m.receiveShadow = true;
          scene.add(m);
          propMeshes.set(it.id, m);
        }
        m.position.copy(worldToThree(it.x, it.y, it.h / 2));
      }
    });
  }

  function resize() {
    const rect = canvas3d.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  // ---- Compact HUD update (no toggle) ----
  function updateHUD(cam) {
    const hcam = document.getElementById('hcam');
    const hlens = document.getElementById('hlens');
    const hExtra = document.getElementById('hExtra');
    if (!hExtra) return;

    const camHeight = cam.z;
    const focalLength = cam.lens;

    // Get all actors, sorted by distance
    const actors = [];
    state.items.forEach(it => {
      if (it.type !== 'actor') return;
      const dx = cam.x - it.x, dy = cam.y - it.y, dz = cam.z - it.z;
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
      actors.push({ label: it.label, dist: dist });
    });
    actors.sort((a,b) => a.dist - b.dist);

    let actorList = actors.map(a => `${a.label} (${a.dist.toFixed(1)}m)`).join(', ');
    if (actorList.length === 0) actorList = 'none';

    // Update HUD elements
    hcam.innerText = state.active;
    hlens.innerText = `Height: ${camHeight.toFixed(2)}m | Focal: ${focalLength}mm`;
    hExtra.innerHTML = `Actors: ${actorList}`;
  }

  // ---- Main render loop ----
  window.Previz3DRender = function () {
    try {
      resize();
      const cam = state.CAMS[state.active];
      const angles = state.fov(cam.lens);
      camera.fov = angles.v * 180 / Math.PI;
      camera.updateProjectionMatrix();
      camera.position.copy(worldToThree(cam.x, cam.y, cam.z));
      camera.lookAt(worldToThree(cam.aimX, cam.aimY, cam.aimZ));
      syncItems();
      if (!renderer.getContext().isContextLost()) {
        renderer.render(scene, camera);
      }
      updateHUD(cam);
    } catch (err) {
      console.error('Render error:', err);
    }
  };

  let use3dActive = true;
  function frameLoop() {
    if (use3dActive && window.Previz3DRender) {
      window.Previz3DRender();
    }
    requestAnimationFrame(frameLoop);
  }

  const toggleChangeHandler = () => {
    use3dActive = toggle.checked;
    canvas2d.style.display = use3dActive ? 'none' : 'block';
    canvas3d.style.display = use3dActive ? 'block' : 'none';
    if (use3dActive) window.Previz3DRender();
  };
  toggle.onchange = toggleChangeHandler;
  toggle.disabled = false;
  toggle.checked = true;
  canvas2d.style.display = 'none';
  canvas3d.style.display = 'block';

  syncItems();
  requestAnimationFrame(frameLoop);
}

if (window.PrevizState) {
  init3D();
} else {
  window.addEventListener('previz-ready', init3D);
}
