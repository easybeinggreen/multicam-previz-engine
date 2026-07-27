// ===== Final 3D viewer with audience, stage, and HUD =====
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

  // ---- Camera (perspective) ----
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

  // ---- Get 3D centre of the auditorium ----
  const roomCenter3D = worldToThree(state.ROOM_CENTER.x, state.ROOM_CENTER.y, 0);

  // ---- Stage floor (ring from R_AUDIENCE to R_VIGNETTE, at z=0) ----
  const stageRingGeo = new THREE.RingGeometry(state.R_AUDIENCE, state.R_VIGNETTE, 64);
  const stageRingMat = new THREE.MeshStandardMaterial({
    color: 0xe0e0e0,
    roughness: 0.7,
    metalness: 0.1,
    side: THREE.DoubleSide,
  });
  const stageRing = new THREE.Mesh(stageRingGeo, stageRingMat);
  stageRing.rotation.x = -Math.PI / 2;
  stageRing.position.copy(roomCenter3D);
  stageRing.receiveShadow = true;
  scene.add(stageRing);

  // ---- Audience floor (below stage by 1.14m) ----
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

  // ---- Step wall (vertical drop from stage to audience pit) ----
  const wallHeight = 1.14;
  const wallGeo = new THREE.CylinderGeometry(state.R_AUDIENCE, state.R_AUDIENCE, wallHeight, 64, 1, true);
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

  // ---- Generate seat positions (same logic as drawFP) ----
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

  // ---- Create seat boxes ----
  const seatGroup = new THREE.Group();
  const seatMat = new THREE.MeshStandardMaterial({ color: 0xb0b0b0, roughness: 0.6 });
  const seatGeo = new THREE.BoxGeometry(state.seatWidth * 0.8, 0.1, state.seatDepth * 0.7);
  seatPositions.forEach(pos => {
    const seat = new THREE.Mesh(seatGeo, seatMat);
    const threePos = worldToThree(pos.x, pos.y, state.audienceFloorZ + 0.05);
    seat.position.copy(threePos);
    // Orient each seat to face the centre (0, ROOM_CENTER.y)
    const dx = 0 - pos.x;
    const dy = ROOM_CENTER.y - pos.y;
    const angle = Math.atan2(dy, dx);
    seat.rotation.y = -angle;
    seat.castShadow = true;
    seat.receiveShadow = true;
    seatGroup.add(seat);
  });
  scene.add(seatGroup);

  // ---- Vignette panels with pastel colours ----
  const vignetteColors = {
    V1: 0xaaccff, // light blue
    V2: 0xffdd99, // light yellow
    V3: 0x99dd99, // light green
    V4: 0xff99cc, // light pink
    V5: 0xcc99ff  // light purple
  };
  Object.entries(state.V).forEach(([name, ang]) => {
    const rad = ang * state.D2R;
    const center = state.pt(ang, state.R_VIGNETTE);
    const geo = new THREE.PlaneGeometry(state.VIGNETTE_WIDTH_M, state.VIGNETTE_HEIGHT_M);
    const color = vignetteColors[name] || 0xcdc4e8;
    const mat = new THREE.MeshStandardMaterial({ 
      color: color,
      side: THREE.DoubleSide,
      roughness: 0.6,
      metalness: 0.1
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(worldToThree(center.x, center.y, state.VIGNETTE_HEIGHT_M / 2));
    const outward = worldToThree(center.x + Math.cos(rad) * 5, center.y + Math.sin(rad) * 5, state.VIGNETTE_HEIGHT_M / 2);
    mesh.lookAt(outward);
    mesh.receiveShadow = true;
    scene.add(mesh);
  });

  // ---- Character model loading (whiter material) ----
  const MODEL_URLS = { brian: './Brian_Upright.glb' };
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

      // Make model whiter
      root.traverse((child) => {
        if (child.isMesh) {
          child.material = new THREE.MeshStandardMaterial({
            color: 0xfafafa,
            roughness: 0.9,
            metalness: 0.0,
            emissive: new THREE.Color(0x000000),
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
      // fallback box
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

  // Preload models
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
          const desiredHeight = it.h || 1.8;
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
        // Props
        let m = propMeshes.get(it.id);
        if (!m) {
          const geo = new THREE.BoxGeometry(it.w, it.h, it.w * 0.7);
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

  // ---- HUD update ----
  function updateHUD(cam) {
    const hcam = document.getElementById('hcam');
    const hlens = document.getElementById('hlens');
    const hscale = document.getElementById('hscale');
    const hExtra = document.getElementById('hExtra');
    if (!hExtra) return;

    const camHeight = cam.z;
    const focalHeight = cam.aimZ;
    const fovDeg = (state.fov(cam.lens).v * 180 / Math.PI).toFixed(1);

    // Find actors in view
    const inView = [];
    const basis = state.camBasis(cam);
    const angles = state.fov(cam.lens);
    const rect = canvas3d.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    if (w > 0 && h > 0) {
      state.items.forEach(it => {
        if (it.type !== 'actor') return;
        const proj = state.project(cam, basis, angles, w, h, it.x, it.y, it.z);
        if (proj && proj.x >= 0 && proj.x <= w && proj.y >= 0 && proj.y <= h) {
          const dx = cam.x - it.x, dy = cam.y - it.y, dz = cam.z - it.z;
          const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
          inView.push({ label: it.label, dist: dist });
        }
      });
    } else {
      state.items.forEach(it => {
        if (it.type !== 'actor') return;
        const dx = cam.x - it.x, dy = cam.y - it.y, dz = cam.z - it.z;
        const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
        inView.push({ label: it.label, dist: dist });
      });
    }

    inView.sort((a,b) => a.dist - b.dist);
    let actorList = inView.map(a => `${a.label} (${a.dist.toFixed(1)}m)`).join(', ');
    if (actorList.length === 0) actorList = 'none';

    hExtra.innerHTML = `
      <div>Height: ${camHeight.toFixed(2)}m | Focal height: ${focalHeight.toFixed(2)}m</div>
      <div>Field of view: ${fovDeg}°</div>
      <div>Actors in view: ${actorList}</div>
    `;
  }

  // Toggle extra HUD
  const hudToggle = document.getElementById('hudToggle');
  if (hudToggle) {
    hudToggle.addEventListener('change', () => {
      const extra = document.getElementById('hExtra');
      if (extra) extra.style.display = hudToggle.checked ? 'block' : 'none';
    });
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

  // ---- Start loop ----
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
