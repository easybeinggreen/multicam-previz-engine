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

  // Lights (unchanged)
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

  // Vignettes (unchanged)
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

  // --- SAFE Brian loader: extract geometries and strip skinning ---
  async function loadBrianModel() {
    const loader = new GLTFLoader();
    const url = './brian.glb';
    console.log('🔄 Attempting to load Brian from:', url);
    try {
      const gltf = await new Promise((resolve, reject) => {
        loader.load(url, resolve, undefined, reject);
      });
      console.log('✅ GLTF loaded successfully!');
      const original = gltf.scene;

      // Log hierarchy (for debugging)
      console.log('🔍 Full hierarchy:');
      original.traverse((child) => {
        const type = child.type;
        const name = child.name || 'unnamed';
        const pos = child.position.toArray().map(v => v.toFixed(3)).join(',');
        console.log(`  ${type} "${name}" pos(${pos})`);
      });

      // --- Build a new static group by extracting geometry and stripping skinning ---
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

      console.log(`📦 Found ${meshes.length} meshes. Creating static copies without skinning...`);

      meshes.forEach((srcMesh) => {
        // Clone the geometry
        const geo = srcMesh.geometry.clone();
        
        // --- CRITICAL: Remove skinning attributes to prevent Three.js from treating this as skinned ---
        if (geo.attributes.skinIndex) geo.deleteAttribute('skinIndex');
        if (geo.attributes.skinWeight) geo.deleteAttribute('skinWeight');
        // Also remove any morph attributes if present (optional)
        if (geo.morphAttributes) {
          for (const key in geo.morphAttributes) {
            delete geo.morphAttributes[key];
          }
        }
        // Ensure the geometry is not seen as skinned
        geo.isSkinnedMesh = false;

        // Create a regular Mesh (not SkinnedMesh) with the cleaned geometry
        const mat = alabasterMat.clone();
        const newMesh = new THREE.Mesh(geo, mat);
        newMesh.position.set(0, 0, 0);
        newMesh.rotation.set(0, 0, 0);
        newMesh.scale.set(1, 1, 1);
        newMesh.castShadow = true;
        newMesh.receiveShadow = true;
        staticGroup.add(newMesh);
      });

      // Apply uniform scale to the entire static group
      const scaleFactor = 0.017;
      staticGroup.scale.set(scaleFactor, scaleFactor, scaleFactor);

      // Optional: center the model (skip for now, assume it's centered)
      console.log('✅ Static Brian model built successfully (skinning stripped)!');
      return staticGroup;
    } catch (err) {
      console.error('❌ Brian failed to load:', err);
      return null;
    }
  }

  const brianModel = await loadBrianModel();
  const actorMeshes = new Map();   // stores the cloned static models for each actor
  const propMeshes = new Map();
  window.__scene = scene;
  window.__meshes = actorMeshes;

  function syncItems() {
    const liveIds = new Set(state.items.map(i => i.id));
    
    // Cleanup
    actorMeshes.forEach((mesh, id) => {
      if (!liveIds.has(id) && !id.toString().endsWith('_debug')) {
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
            console.log(`✅ Brian static clone created for actor ${it.id}`);
          } else {
            // Fallback: colored box
            console.warn(`⚠️ No Brian model – using fallback box for actor ${it.id}`);
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

        // --- Position the root ---
        const pos = worldToThree(it.x, it.y, 0);
        g.position.copy(pos);

        // --- Rotation (facing) ---
        const facingRad = it.facing * state.D2R;
        g.rotation.y = -facingRad + Math.PI / 2;

        // --- Scale test for lead actor ---
        if (it.id === 1 && brianModel) {
          g.scale.set(0.017 * 3, 0.017 * 3, 0.017 * 3);
          g.rotation.y += 0.05; // spin
        } else if (brianModel) {
          g.scale.set(0.017, 0.017, 0.017);
        } else {
          g.scale.set(1, 1, 1);
        }

        g.updateMatrixWorld(true);

        // --- DEBUG red sphere (always present) ---
        let debugSphere = actorMeshes.get(it.id + '_debug');
        if (!debugSphere) {
          const sphereGeo = new THREE.SphereGeometry(0.3, 8, 8);
          const sphereMat = new THREE.MeshStandardMaterial({ 
            color: 0xff0000,
            emissive: 0xff0000,
            emissiveIntensity: 0.3
          });
          debugSphere = new THREE.Mesh(sphereGeo, sphereMat);
          debugSphere.castShadow = true;
          scene.add(debugSphere);
          actorMeshes.set(it.id + '_debug', debugSphere);
        }
        debugSphere.position.copy(pos);

        console.log(`[sync] Actor ${it.id} at (${it.x.toFixed(2)}, ${it.y.toFixed(2)}) → root pos (${g.position.x.toFixed(2)}, ${g.position.y.toFixed(2)}, ${g.position.z.toFixed(2)})`);
      } else {
        // Props (unchanged)
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

  // Main render function – with error safety
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
      
      const ctxLost = renderer.getContext().isContextLost();
      if (ctxLost) {
        console.warn('⚠️ WebGL context lost!');
        return;
      }
      
      renderer.render(scene, camera);
    } catch (err) {
      console.error('❌ Render error:', err);
      // Do NOT disable 3D – just log and continue
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
  
  // Start loop
  requestAnimationFrame(frameLoop);
}

// Wait for main app
if (window.PrevizState) {
  init3D();
} else {
  window.addEventListener('previz-ready', init3D);
}
