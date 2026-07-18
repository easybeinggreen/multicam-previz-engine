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

  async function loadBrianModel() {
    const loader = new GLTFLoader();
    const url = './brian.glb';
    console.log('🔄 Attempting to load Brian from:', url);
    try {
      const gltf = await new Promise((resolve, reject) => {
        loader.load(url, resolve, undefined, reject);
      });
      console.log('✅ GLTF loaded successfully!');
      const model = gltf.scene;
      
      // --- CRITICAL: Disable all animations ---
      if (gltf.animations && gltf.animations.length > 0) {
        console.log(`🎬 Found ${gltf.animations.length} animations - disabling them`);
        gltf.animations = []; // Remove all animations
      }
      
      // Stop any existing animation mixer (if any)
      if (window._mixer) {
        window._mixer.stopAllAction();
        window._mixer = null;
      }

      // --- CRITICAL: Reset all bone transforms to identity ---
      model.traverse((child) => {
        if (child.isBone) {
          child.position.set(0, 0, 0);
          child.rotation.set(0, 0, 0);
          child.scale.set(1, 1, 1);
          child.updateMatrixWorld(true);
        }
        if (child.isSkinnedMesh) {
          // Reset bind matrix
          child.bindMatrix.identity();
          child.bindMatrixInverse.identity();
          if (child.skeleton) {
            child.skeleton.bones.forEach(bone => {
              bone.position.set(0, 0, 0);
              bone.rotation.set(0, 0, 0);
              bone.scale.set(1, 1, 1);
            });
          }
        }
      });

      // Apply base scale and centering
      const scaleFactor = 0.017;
      model.scale.set(scaleFactor, scaleFactor, scaleFactor);
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      model.position.y = -center.y + (size.y / 2);
      
      // Apply alabaster material
      const alabasterMat = new THREE.MeshStandardMaterial({
        color: 0xf5f0eb,
        roughness: 0.4,
        metalness: 0.0,
        emissive: new THREE.Color(0x222222),
        emissiveIntensity: 0.05,
      });
      
      model.traverse((child) => {
        if (child.isMesh) {
          child.material = alabasterMat.clone();
          child.castShadow = true;
          child.receiveShadow = true;
          // Remove morph targets that might affect position
          if (child.morphTargetInfluences) {
            child.morphTargetInfluences = [];
          }
        }
      });
      
      console.log('✅ Brian is ready with all animations/transforms disabled!');
      return model;
    } catch (err) {
      console.error('❌ Brian failed to load:', err);
      console.error('Make sure brian.glb is in the same folder as index.html');
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
    
    // Clean up removed items (including debug spheres)
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
            // --- Deep clone to get a fresh copy ---
            g = brianModel.clone(true);
            
            // --- Strip any leftover animation state ---
            g.userData = { isBrian: true, actorId: it.id };
            
            // --- Reset every node's local transform to identity ---
            g.traverse((child) => {
              child.position.set(0, 0, 0);
              child.rotation.set(0, 0, 0);
              child.scale.set(1, 1, 1);
              if (child.isSkinnedMesh) {
                child.bindMatrix.identity();
                child.bindMatrixInverse.identity();
                if (child.skeleton) {
                  child.skeleton.bones.forEach(bone => {
                    bone.position.set(0, 0, 0);
                    bone.rotation.set(0, 0, 0);
                    bone.scale.set(1, 1, 1);
                  });
                }
              }
              child.updateMatrixWorld(true);
            });
            
            // Reset root
            g.position.set(0, 0, 0);
            g.rotation.set(0, 0, 0);
            g.scale.set(1, 1, 1);
            g.matrix.identity();
            g.matrixAutoUpdate = true;
            
            scene.add(g);
            actorMeshes.set(it.id, g);
            console.log(`✅ Brian clone created for actor ${it.id} with animations/transforms cleared`);
            
            // Log hierarchy to debug
            console.log(`🔍 Model structure for actor ${it.id}:`);
            g.traverse((child) => {
              if (child.isMesh || child.isSkinnedMesh) {
                console.log(`  - ${child.type}: ${child.name || 'unnamed'}`, child.position);
              }
            });
          } else {
            console.warn(`⚠️ No Brian model – actor ${it.id} not rendered`);
            return;
          }
        }

        // --- Now apply the actor's world position to the root ---
        const pos = worldToThree(it.x, it.y, 0);
        g.position.copy(pos);

        // --- Force all child meshes to local (0,0,0) so they follow root exactly ---
        g.traverse((child) => {
          if (child.isMesh || child.isSkinnedMesh) {
            child.position.set(0, 0, 0);
            child.rotation.set(0, 0, 0);
            child.scale.set(1, 1, 1);
            child.updateMatrixWorld(true);
          }
        });

        // --- Apply rotation (facing) to root ---
        const facingRad = it.facing * state.D2R;
        g.rotation.y = -facingRad + Math.PI / 2; // Adjust offset if needed

        // --- Scale: make lead actor bigger and spinning for easy visual confirmation ---
        if (it.id === 1) {
          g.scale.set(0.017 * 3, 0.017 * 3, 0.017 * 3);
          // Spin continuously
          g.rotation.y += 0.05;
        } else {
          g.scale.set(0.017, 0.017, 0.017);
        }

        // --- Force matrix update on entire hierarchy ---
        g.updateMatrixWorld(true);

        // --- DEBUG: Red sphere at actor position (already confirmed working) ---
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

        console.log(`[sync] Actor ${it.id} at (${it.x.toFixed(2)}, ${it.y.toFixed(2)}) → root pos (${g.position.x.toFixed(2)}, ${g.position.y.toFixed(2)}, ${g.position.z.toFixed(2)}) scale ${g.scale.x.toFixed(3)}`);
        
      } else {
        // Props (already working)
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
    
    console.log(`📊 Scene has ${scene.children.length} children (${actorMeshes.size} actor meshes, ${propMeshes.size} prop meshes)`);
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
      console.warn('⚠️ WebGL context is lost!');
      toggle.checked = false;
      if (toggle.onchange) toggle.onchange();
      toggle.disabled = true;
      window.Previz3DRender = null;
      return;
    }
    
    try {
      renderer.render(scene, camera);
    } catch (err) {
      console.warn('3D render failed at runtime — switching back to 2D.', err);
      toggle.checked = false;
      if (toggle.onchange) toggle.onchange();
      toggle.disabled = true;
      window.Previz3DRender = null;
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
    if (use3dActive) {
      if (window.Previz3DRender) window.Previz3DRender();
    }
  };

  toggle.onchange = toggleChangeHandler;
  toggle.disabled = false;
  toggle.checked = true;
  canvas2d.style.display = 'none';
  canvas3d.style.display = 'block';

  // Initial sync
  syncItems();
  
  // Start the render loop
  requestAnimationFrame(frameLoop);
}

// Wait for the main app to signal it's ready
if (window.PrevizState) {
  init3D();
} else {
  window.addEventListener('previz-ready', init3D);
}
