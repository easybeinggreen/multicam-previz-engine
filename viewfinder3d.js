// ===== Progressive-enhancement 3D viewfinder =====
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

function worldToThree(x, y, z) { 
  return new THREE.Vector3(x, z, -y); 
}

async function init3D() {
  const canvas3d = document.getElementById('vf3d');
  const toggle = document.getElementById('use3d');
  const canvas2d = document.getElementById('vf');
  if (!canvas3d || !toggle) return;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas3d, antialias: true });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
  } catch (err) {
    console.warn('3D viewfinder unavailable — WebGL could not initialise. Staying on 2D.', err);
    return;
  }

  canvas3d.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    console.error('❌ WebGL context was lost.');
  });
  canvas3d.addEventListener('webglcontextrestored', () => {
    console.warn('✅ WebGL context restored.');
  });

  const state = window.PrevizState;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf5f0eb);
  
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 200);

  // Lighting
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

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshStandardMaterial({ color: 0xe8e4df, roughness: 0.8 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Vignette panels
  Object.entries(state.V).forEach(([name, ang]) => {
    const rad = ang * state.D2R;
    const center = state.pt(ang, state.R_VIGNETTE);
    const geo = new THREE.PlaneGeometry(state.VIGNETTE_WIDTH_M, state.VIGNETTE_HEIGHT_M);
    const mat = new THREE.MeshStandardMaterial({ 
      color: 0xcdc4e8, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.1
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(worldToThree(center.x, center.y, state.VIGNETTE_HEIGHT_M / 2));
    const outward = worldToThree(center.x + Math.cos(rad) * 5, center.y + Math.sin(rad) * 5, state.VIGNETTE_HEIGHT_M / 2);
    mesh.lookAt(outward);
    mesh.receiveShadow = true;
    scene.add(mesh);
  });

  // --- Load Brian, auto‑orient, scale, and ground ---
  async function loadBrianModel() {
    const loader = new GLTFLoader();
    const url = './Brian_Final.glb';
    console.log('🔄 Loading Brian from:', url);
    try {
      const gltf = await loader.loadAsync(url);
      console.log('✅ GLTF loaded');

      // 1. Wrap original scene
      const modelRoot = new THREE.Group();
      modelRoot.add(gltf.scene);

      // 2. Measure raw bounding box
      modelRoot.updateMatrixWorld();
      const rawBox = new THREE.Box3().setFromObject(modelRoot);
      const rawSize = new THREE.Vector3();
      rawBox.getSize(rawSize);
      console.log('📦 Raw bounding box size (X, Y, Z):', rawSize);

      // 3. Determine which axis is height (largest dimension)
      const { x: dx, y: dy, z: dz } = rawSize;
      let heightAxis = 'y';
      let standRotation = null;

      if (dz >= dy && dz >= dx) {
        heightAxis = 'z';
        standRotation = new THREE.Euler(-Math.PI / 2, 0, 0); // Z → Y (rotate -90° around X)
        console.log('🔄 Height axis is Z, will rotate -90° around X');
      } else if (dx >= dy && dx >= dz) {
        heightAxis = 'x';
        standRotation = new THREE.Euler(0, 0, -Math.PI / 2); // X → Y (rotate -90° around Z)
        console.log('🔄 Height axis is X, will rotate -90° around Z');
      } else {
        console.log('🔄 Height axis already Y, no stand rotation needed');
      }

      // Apply stand rotation inside a helper group
      if (standRotation) {
        const rotator = new THREE.Group();
        rotator.rotation.copy(standRotation);
        // Move all children of modelRoot into rotator
        while (modelRoot.children.length) {
          rotator.add(modelRoot.children[0]);
        }
        modelRoot.add(rotator);
      }

      // 4. Now check if the model is upside‑down (feet at max Y)
      modelRoot.updateMatrixWorld();
      const orientedBox = new THREE.Box3().setFromObject(modelRoot);
      const orientedSize = new THREE.Vector3();
      orientedBox.getSize(orientedSize);
      console.log('📦 Oriented bounding box size:', orientedSize);

      const headEnd = orientedBox.max.y;   // top of the model after rotation
      const feetEnd = orientedBox.min.y;
      // If the taller part is at max Y, it's head up -> correct. If shorter part is at max Y, it's upside‑down.
      // We assume the character's height is orientedSize.y, and the head should be the larger vertical extent (usually).
      // A simple heuristic: if the bounding box min Y is closer to 0 than max Y? Not reliable.
      // Instead, we just check if the model appears upside‑down by testing a known point: after standing,
      // the model's feet should be at min Y if it was originally Z-up with feet at min Z.
      // We can directly compare: if the original raw bounding box min Z (feet) becomes max Y after rotation, then flip.
      const originalMinZ = rawBox.min.z;
      // Transform that point by the rotation matrix
      const footPoint = new THREE.Vector3(0, 0, originalMinZ);
      if (standRotation) {
        const rotMatrix = new THREE.Matrix4().makeRotationFromEuler(standRotation);
        footPoint.applyMatrix4(rotMatrix);
      }
      // footPoint.y is where the original feet would be after rotation.
      // If footPoint.y is near max Y, the model is upside‑down.
      const predictedFootY = footPoint.y;
      console.log('🔍 Predicted foot Y after rotation:', predictedFootY);

      if (predictedFootY > orientedBox.max.y - 0.01) {
        // Feet are at top -> flip 180° around X
        console.log('🙃 Model is upside‑down, flipping 180° around X');
        const flipper = new THREE.Group();
        flipper.rotation.x = Math.PI;
        // Move everything from modelRoot into flipper
        while (modelRoot.children.length) {
          flipper.add(modelRoot.children[0]);
        }
        modelRoot.add(flipper);
        // Update bounding box after flip
        modelRoot.updateMatrixWorld();
      }

      // 5. Scale to 1.8 m using the Y dimension
      const finalBox = new THREE.Box3().setFromObject(modelRoot);
      const finalSize = new THREE.Vector3();
      finalBox.getSize(finalSize);
      const currentHeight = finalSize.y;
      const desiredHeight = 1.8;
      if (currentHeight > 0.001) {
        const scale = desiredHeight / currentHeight;
        modelRoot.scale.set(scale, scale, scale);
        console.log(`📏 Brian scaled: ${currentHeight.toFixed(2)} → ${desiredHeight}m`);
      } else {
        console.warn('⚠️ Brian height is zero – using scale 1');
      }

      // 6. Shift feet to ground (min Y = 0)
      modelRoot.updateMatrixWorld();
      const groundBox = new THREE.Box3().setFromObject(modelRoot);
      const feetY = groundBox.min.y;
      console.log('🦶 Feet Y before ground shift:', feetY);
      modelRoot.position.y = -feetY;

      // 7. Apply alabaster material to all meshes
      modelRoot.traverse((child) => {
        if (child.isMesh) {
          child.material = new THREE.MeshStandardMaterial({
            color: 0xf5f0eb,
            roughness: 0.9,
            metalness: 0.0,
            emissive: new THREE.Color(0x000000),
          });
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      console.log('✅ Brian auto‑oriented, scaled, and grounded');
      return modelRoot;
    } catch (err) {
      console.error('❌ Brian load failed:', err.message, err);
      return null;
    }
  }

  const brianTemplate = await loadBrianModel();
  console.log('🧑‍🎨 Brian template is null?', brianTemplate === null);
  const actorMeshes = new Map();
  const propMeshes = new Map();
  window.__scene = scene;
  window.__meshes = actorMeshes;

  function syncItems() {
    const liveIds = new Set(state.items.map(i => i.id));
    
    actorMeshes.forEach((mesh, id) => { if (!liveIds.has(id)) { scene.remove(mesh); actorMeshes.delete(id); } });
    propMeshes.forEach((mesh, id) => { if (!liveIds.has(id)) { scene.remove(mesh); propMeshes.delete(id); } });

    state.items.forEach(it => {
      if (it.type === 'actor') {
        let actorGroup = actorMeshes.get(it.id);
        if (!actorGroup) {
          if (brianTemplate) {
            actorGroup = brianTemplate.clone(true);
            actorGroup.userData = { isBrian: true, actorId: it.id };
            scene.add(actorGroup);
            actorMeshes.set(it.id, actorGroup);
            console.log(`➕ Added Brian for actor ${it.id}`);
          } else {
            console.warn(`⚠️ No Brian model – fallback box for actor ${it.id}`);
            const geo = new THREE.BoxGeometry(0.6, 1.8, 0.4);
            const mat = new THREE.MeshStandardMaterial({ color: 0x8888ff });
            const box = new THREE.Mesh(geo, mat);
            box.castShadow = true; box.receiveShadow = true;
            box.userData = { isBrian: false, actorId: it.id };
            scene.add(box);
            actorMeshes.set(it.id, box);
            actorGroup = box;
          }
        }

        // Position at world location (feet already at ground)
        actorGroup.position.copy(worldToThree(it.x, it.y, 0));

        // Facing rotation (spins around world Y)
        const facingRad = it.facing * state.D2R;
        actorGroup.rotation.y = -facingRad + Math.PI / 2;

        actorGroup.updateMatrixWorld(true);
      } else {
        // Props (cuboid)
        let m = propMeshes.get(it.id);
        if (!m) {
          const geo = new THREE.BoxGeometry(it.w, it.h, it.w * 0.7);
          const mat = new THREE.MeshStandardMaterial({ color: it.color, roughness: 0.7 });
          m = new THREE.Mesh(geo, mat);
          m.castShadow = true; m.receiveShadow = true;
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

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
