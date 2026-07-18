// ===== Progressive-enhancement 3D viewfinder =====
// Uses importmap to load three.js and GLTFLoader

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
    console.error('❌ WebGL context was lost — this is why the screen froze.');
  });
  canvas3d.addEventListener('webglcontextrestored', () => {
    console.warn('✅ WebGL context restored, resuming render.');
  });

  const state = window.PrevizState;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf5f0eb);
  
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 200);

  // Lighting
  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);
  
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
      color: 0xcdc4e8,
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

  // --- Build static Brian model (skinning stripped) ---
  async function loadBrianModel() {
    const loader = new GLTFLoader();
    const url = './brian.glb';
    console.log('🔄 Loading Brian from:', url);
    try {
      const gltf = await new Promise((resolve, reject) => {
        loader.load(url, resolve, undefined, reject);
      });
      console.log('✅ GLTF loaded');
      const original = gltf.scene;

      const staticGroup = new THREE.Group();
      staticGroup.name = 'BrianStatic';

      const alabasterMat = new THREE.MeshStandardMaterial({
        color: 0xf5f0eb,
        roughness: 0.4,
        metalness: 0.0,
        emissive: new THREE.Color(0x222222),
        emissiveIntensity: 0.05,
      });

      // Collect all meshes (including SkinnedMesh)
      const meshes = [];
      original.traverse((child) => {
        if (child.isMesh || child.isSkinnedMesh) {
          meshes.push(child);
        }
      });

      meshes.forEach((srcMesh) => {
        const geo = srcMesh.geometry.clone();
        // Remove skinning attributes to prevent Three.js from treating as skinned
        if (geo.attributes.skinIndex) geo.deleteAttribute('skinIndex');
        if (geo.attributes.skinWeight) geo.deleteAttribute('skinWeight');
        if (geo.morphAttributes) {
          for (const key in geo.morphAttributes) {
            delete geo.morphAttributes[key];
          }
        }
        geo.isSkinnedMesh = false;

        const mat = alabasterMat.clone();
        const newMesh = new THREE.Mesh(geo, mat);
        newMesh.position.set(0, 0, 0);
        newMesh.rotation.set(0, 0, 0);
        newMesh.scale.set(1, 1, 1);
        newMesh.castShadow = true;
        newMesh.receiveShadow = true;
        staticGroup.add(newMesh);
      });

      // Scale to achieve ~1.8m height (adjust this factor if needed)
      // The current factor 0.017 gives a height that looks correct per user feedback.
      const scaleFactor = 0.017;
      staticGroup.scale.set(scaleFactor, scaleFactor, scaleFactor);

      console.log('✅ Static Brian ready (skinning stripped)');
      return staticGroup;
    } catch (err) {
      console.error('❌ Brian load failed:', err);
      return null;
    }
  }

  const brianModel = await loadBrianModel();
  const actorMeshes = new Map();
  const propMeshes = new Map();
  window.__scene = scene;
  window.__meshes = actorMeshes;

  function syncItems() {
    const liveIds = new Set(state.items.map(i => i.id));
    
    // Cleanup removed actors and props
    actorMeshes.forEach((mesh, id) => {
      if (!liveIds.has(id)) {
        scene.remove(mesh);
        actorMeshes.delete(id);
      }
    });
    propMeshes.forEach((mesh, id) => {
      if (!liveIds.has(id)) {
        scene.remove(mesh);
        propMeshes.delete(id);
      }
    });

    state.items.forEach(it => {
      if (it.type === 'actor') {
        let g = actorMeshes.get(it.id);
        if (!g) {
          if (brianModel) {
            g = brianModel.clone(true);
            g.userData = { isBrian: true, actorId: it.id };
            scene.add(g);
            actorMeshes.set(it.id, g);
          } else {
            // Fallback: coloured box (should rarely happen)
            console.warn(`⚠️ No Brian model – fallback box for actor ${it.id}`);
            const geo = new THREE.BoxGeometry(0.6, 1.8, 0.4);
            const mat = new THREE.MeshStandardMaterial({ color: 0x8888ff });
            g = new THREE.Mesh(geo, mat);
            g.castShadow = true;
            g.receiveShadow = true;
            g.userData = { isBrian: false, actorId: it.id };
            scene.add(g);
            actorMeshes.set(it.id, g);
          }
        }

        // Apply world position
        const pos = worldToThree(it.x, it.y, 0);
        g.position.copy(pos);

        // Apply facing rotation
        const facingRad = it.facing * state.D2R;
        g.rotation.y = -facingRad + Math.PI / 2;

        // Uniform scale (all actors same size)
        if (brianModel) {
          g.scale.set(0.017, 0.017, 0.017);
        } else {
          g.scale.set(1, 1, 1);
        }

        g.updateMatrixWorld(true);
      } else {
        // Props (unchanged, already working)
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  // Main render loop with error safety
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
      
      if (renderer.getContext().isContextLost()) {
        console.warn('WebGL context lost, skipping render');
        return;
      }
      renderer.render(scene, camera);
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
    if (use3dActive && window.Previz3DRender) {
      window.Previz3DRender();
    }
  };

  toggle.onchange = toggleChangeHandler;
  toggle.disabled = false;
  toggle.checked = true;
  canvas2d.style.display = 'none';
  canvas3d.style.display = 'block';

  // Initial sync
  syncItems();
  requestAnimationFrame(frameLoop);
}

// Wait for main app
if (window.PrevizState) {
  init3D();
} else {
  window.addEventListener('previz-ready', init3D);
}
