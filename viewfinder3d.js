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

  // --- Load Brian (already Y‑up, just flipped upright and scaled) ---
  async function loadBrianModel() {
    const loader = new GLTFLoader();
    const url = './Brian_Baked.glb';
    console.log('🔄 Loading Brian from:', url);
    try {
      const gltf = await loader.loadAsync(url);
      console.log('✅ GLTF loaded, scene children:', gltf.scene.children.length);

      // The exported file is Y‑up, but feet are at max Y and head at min Y.
      // Group that flips the model 180° around X so feet go to min Y.
      const flipGroup = new THREE.Group();
      flipGroup.rotation.x = Math.PI;   // vertical flip
      flipGroup.add(gltf.scene);

      // Root template (cloned per actor)
      const brianRoot = new THREE.Group();
      brianRoot.name = 'BrianRoot';
      brianRoot.add(flipGroup);

      // Alabaster material override
      brianRoot.traverse((child) => {
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

      // Measure height along Y after flip (Y should still be the up axis)
      flipGroup.updateMatrixWorld();
      const box = new THREE.Box3().setFromObject(flipGroup);
      const size = new THREE.Vector3();
      box.getSize(size);
      console.log('📦 Flipped bounding box size:', size);
      const currentHeight = size.y;
      const desiredHeight = 1.8;
      if (currentHeight > 0.001) {
        const scale = desiredHeight / currentHeight;
        flipGroup.scale.set(scale, scale, scale);
        console.log(`📏 Brian scaled: ${currentHeight.toFixed(2)} → ${desiredHeight}m (factor ${scale.toFixed(3)})`);
      } else {
        console.warn('⚠️ Brian height is nearly zero – using scale 1');
      }

      // After flip, feet are at min Y. Shift so feet touch ground (min Y = 0)
      flipGroup.updateMatrixWorld();
      const boxAfterScale = new THREE.Box3().setFromObject(flipGroup);
      const feetY = boxAfterScale.min.y;
      console.log('🦶 Feet Y before shift:', feetY);
      flipGroup.position.y = -feetY;

      console.log('✅ Brian ready (upright, right-side up, height 1.8m)');
      return brianRoot;
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
