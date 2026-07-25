// ===== FINAL FIX – Skinning stripped, bright red, big axes, auto-orient =====
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
  scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const mainLight = new THREE.DirectionalLight(0xffeedd, 1.5);
  mainLight.position.set(10, 15, 10);
  mainLight.castShadow = true;
  mainLight.shadow.mapSize.set(2048, 2048);
  scene.add(mainLight);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshStandardMaterial({ color: 0xe8e4df, roughness: 0.8 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Vignette panels (if any)
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

  // --- Load Brian, fully automatic orientation, strip skinning, bright red ---
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
      console.log('📦 Raw bounding box (X,Y,Z):', rawSize.x, rawSize.y, rawSize.z);

      const { x: dx, y: dy, z: dz } = rawSize;
      let heightAxis = 'y';
      let standRotation = null;

      if (dz >= dy && dz >= dx) {
        heightAxis = 'z';
        standRotation = new THREE.Euler(-Math.PI / 2, 0, 0); // Z -> Y (rotate -90° around X)
        console.log('🔄 Height axis is Z, rotating -90° around X');
      } else if (dx >= dy && dx >= dz) {
        heightAxis = 'x';
        standRotation = new THREE.Euler(0, 0, -Math.PI / 2); // X -> Y
        console.log('🔄 Height axis is X, rotating -90° around Z');
      } else {
        console.log('🔄 Height axis is Y, no rotation needed');
      }

      // Apply stand rotation inside a helper group
      if (standRotation) {
        const rotator = new THREE.Group();
        rotator.rotation.copy(standRotation);
        while (modelRoot.children.length) {
          rotator.add(modelRoot.children[0]);
        }
        modelRoot.add(rotator);
        modelRoot.updateMatrixWorld();
      }

      // 3. Check for upside-down
      const uprightBox = new THREE.Box3().setFromObject(modelRoot);
      // Original feet point (raw min Z, assuming feet at min Z)
      const originalFeet = new THREE.Vector3(0, 0, rawBox.min.z);
      if (standRotation) {
        const rotMatrix = new THREE.Matrix4().makeRotationFromEuler(standRotation);
        originalFeet.applyMatrix4(rotMatrix);
      }
      console.log('🔍 Predicted feet Y after rotation:', originalFeet.y);
      if (originalFeet.y > uprightBox.max.y - 0.1) {
        console.log('🙃 Model upside‑down, flipping 180° around X');
        const flipper = new THREE.Group();
        flipper.rotation.x = Math.PI;
        while (modelRoot.children.length) {
          flipper.add(modelRoot.children[0]);
        }
        modelRoot.add(flipper);
        modelRoot.updateMatrixWorld();
      }

      // 4. Strip skinning and convert to static meshes
      const staticGroup = new THREE.Group();
      modelRoot.updateMatrixWorld(); // ensure transforms are up-to-date
      modelRoot.traverse((child) => {
        if (child.isMesh || child.isSkinnedMesh) {
          const geo = child.geometry.clone();
          // Remove skinning attributes if present
          if (geo.attributes.skinIndex) geo.deleteAttribute('skinIndex');
          if (geo.attributes.skinWeight) geo.deleteAttribute('skinWeight');
          // Remove morph attributes
          if (geo.morphAttributes) {
            for (const key in geo.morphAttributes) {
              delete geo.morphAttributes[key];
            }
          }
          const mesh = new THREE.Mesh(geo, child.material.clone());
          // Apply the same world transform from the original node
          child.updateWorldMatrix(true, false);
          mesh.applyMatrix4(child.matrixWorld);
          staticGroup.add(mesh);
        }
      });

      // Clear modelRoot and replace with the static group
      while (modelRoot.children.length) modelRoot.remove(modelRoot.children[0]);
      modelRoot.add(staticGroup);

      // 5. Scale to 1.8m
      const finalBox = new THREE.Box3().setFromObject(modelRoot);
      const finalSize = new THREE.Vector3();
      finalBox.getSize(finalSize);
      console.log('📦 Final static box size:', finalSize);
      const currentHeight = finalSize.y;
      const desiredHeight = 1.8;
      if (currentHeight > 0.001) {
        const scale = desiredHeight / currentHeight;
        modelRoot.scale.set(scale, scale, scale);
        console.log(`📏 Brian scaled: ${currentHeight.toFixed(2)} → ${desiredHeight}m`);
      } else {
        console.warn('⚠️ Brian height is zero – using scale 1');
      }

      // 6. Shift feet to ground
      modelRoot.updateMatrixWorld();
      const groundBox = new THREE.Box3().setFromObject(modelRoot);
      const feetY = groundBox.min.y;
      console.log('🦶 Feet Y before shift:', feetY);
      modelRoot.position.y = -feetY;

      // 7. Apply BRIGHT RED material
      modelRoot.traverse((child) => {
        if (child.isMesh) {
          child.material = new THREE.MeshStandardMaterial({
            color: 0xff0000,
            roughness: 0.5,
            metalness: 0.0,
            emissive: new THREE.Color(0x330000),
          });
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      console.log('✅ Bright red Brian ready with static meshes');
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
            // Add big axis helper at the actor's feet
            const bigAxes = new THREE.AxesHelper(5);
            actorGroup.add(bigAxes);
            console.log(`➕ Added Brian for actor ${it.id} with BIG AXES (5m)`);
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
