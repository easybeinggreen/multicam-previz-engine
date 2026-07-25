// ===== DIAGNOSTIC VERSION - Bright red Brian, large axis helper, verbose logging =====
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
  mainLight.shadow.camera.left = -20;
  mainLight.shadow.camera.right = 20;
  mainLight.shadow.camera.top = 20;
  mainLight.shadow.camera.bottom = -20;
  scene.add(mainLight);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshStandardMaterial({ color: 0xe8e4df, roughness: 0.8 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // --- Load Brian and make him bright red with huge axis arrows ---
  async function loadBrianModel() {
    const loader = new GLTFLoader();
    const url = './Brian_Final.glb';
    console.log('🔄 Loading Brian from:', url);
    try {
      const gltf = await loader.loadAsync(url);
      console.log('✅ GLTF loaded');

      const modelRoot = new THREE.Group();
      modelRoot.add(gltf.scene);

      // Raw bounding box
      modelRoot.updateMatrixWorld();
      const rawBox = new THREE.Box3().setFromObject(modelRoot);
      const rawSize = new THREE.Vector3();
      rawBox.getSize(rawSize);
      console.log('📦 Raw bounding box size (X, Y, Z):', rawSize.x, rawSize.y, rawSize.z);
      console.log('   Raw min:', rawBox.min.toArray(), 'max:', rawBox.max.toArray());

      // Determine height axis and rotate to stand
      const { x: dx, y: dy, z: dz } = rawSize;
      let standRotation = null;
      if (dz >= dy && dz >= dx) {
        standRotation = new THREE.Euler(-Math.PI / 2, 0, 0);
        console.log('🔄 Height axis is Z, rotating -90° around X');
      } else if (dx >= dy && dx >= dz) {
        standRotation = new THREE.Euler(0, 0, -Math.PI / 2);
        console.log('🔄 Height axis is X, rotating -90° around Z');
      } else {
        console.log('🔄 Height axis is Y, no rotation needed');
      }

      if (standRotation) {
        const rotator = new THREE.Group();
        rotator.rotation.copy(standRotation);
        while (modelRoot.children.length) {
          rotator.add(modelRoot.children[0]);
        }
        modelRoot.add(rotator);
        modelRoot.updateMatrixWorld();
      }

      // Check upside-down and flip if needed
      const uprightBox = new THREE.Box3().setFromObject(modelRoot);
      const originalFeet = new THREE.Vector3(0, 0, rawBox.min.z);
      if (standRotation) {
        const m = new THREE.Matrix4().makeRotationFromEuler(standRotation);
        originalFeet.applyMatrix4(m);
      }
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

      // Final bounding box
      const finalBox = new THREE.Box3().setFromObject(modelRoot);
      const finalSize = new THREE.Vector3();
      finalBox.getSize(finalSize);
      console.log('📦 Final box min Y:', finalBox.min.y, 'max Y:', finalBox.max.y, 'height:', finalSize.y);

      // Scale to 1.8m
      const currentHeight = finalSize.y;
      const desiredHeight = 1.8;
      if (currentHeight > 0.001) {
        const scale = desiredHeight / currentHeight;
        modelRoot.scale.set(scale, scale, scale);
        console.log(`📏 Brian scaled: ${currentHeight.toFixed(2)} → ${desiredHeight}m`);
      }

      // Shift feet to ground
      modelRoot.updateMatrixWorld();
      const groundBox = new THREE.Box3().setFromObject(modelRoot);
      const feetY = groundBox.min.y;
      console.log('🦶 Feet Y before shift:', feetY);
      modelRoot.position.y = -feetY;

      // *** BRIGHT RED MATERIAL for visibility ***
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

      console.log('✅ Brian ready (BRIGHT RED)');
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
            // *** Add huge axis helper (5m) to the actor group ***
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

        // Position at world coordinates
        const worldPos = worldToThree(it.x, it.y, 0);
        console.log(`📍 Actor ${it.id} position:`, worldPos.toArray());
        actorGroup.position.copy(worldPos);

        // TEMPORARILY DISABLE FACING ROTATION for clean view
        // const facingRad = it.facing * state.D2R;
        // actorGroup.rotation.y = -facingRad + Math.PI / 2;

        actorGroup.updateMatrixWorld(true);
        console.log(`🔵 Actor ${it.id} world matrix:`, actorGroup.matrixWorld.elements);
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
