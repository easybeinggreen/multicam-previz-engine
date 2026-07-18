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

  // --- Brian loader with aggressive flattening ---
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
      
      // --- Dump structure to see what we're dealing with ---
      console.log('🔍 Full hierarchy of loaded Brian:');
      original.traverse((child) => {
        const type = child.type;
        const name = child.name || 'unnamed';
        const pos = child.position.toArray().map(v => v.toFixed(3)).join(',');
        console.log(`  ${type} "${name}" pos(${pos})`);
      });

      // --- 1. Remove all animations ---
      if (gltf.animations) gltf.animations.length = 0;
      
      // --- 2. Create a new empty group as our clean root ---
      const cleanRoot = new THREE.Group();
      cleanRoot.name = 'BrianCleanRoot';
      
      // --- 3. Find all meshes (including skinned meshes) and detach them from their parents ---
      const meshes = [];
      original.traverse((child) => {
        if (child.isMesh || child.isSkinnedMesh) {
          meshes.push(child);
        }
      });
      
      console.log(`📦 Found ${meshes.length} meshes. Reparenting them to clean root...`);
      
      meshes.forEach((mesh) => {
        // Detach from current parent (if any)
        const parent = mesh.parent;
        if (parent) {
          // Remove from parent but keep world transform
          // We want the mesh to be a direct child of cleanRoot with zero local transform.
          // So we temporarily store its world position, then reset local.
          const worldPos = new THREE.Vector3();
          mesh.getWorldPosition(worldPos);
          
          // Remove from parent
          parent.remove(mesh);
          
          // Add to cleanRoot
          cleanRoot.add(mesh);
          
          // Reset local transform to identity
          mesh.position.set(0, 0, 0);
          mesh.rotation.set(0, 0, 0);
          mesh.scale.set(1, 1, 1);
          mesh.matrix.identity();
          mesh.matrixAutoUpdate = true;
          
          // Now we will move the whole cleanRoot to the world position of the mesh later.
          // But we need to also store the mesh's geometry offset? For now, we assume the mesh
          // geometry is centered at origin, so setting local (0,0,0) places it at the root's position.
          // That is what we want.
          
          // However, if the mesh had a position offset originally (e.g., the model is not centered),
          // we might need to keep that offset. But since we are moving the root, we can just set
          // the mesh's local position to (0,0,0) and rely on the root to position it.
          // But if the mesh was originally at (x,y,z) relative to its parent, that offset is lost.
          // Better: we can record the mesh's local position relative to the original root
          // and then apply it as an offset to the mesh's local position after reparenting.
          // However, we want the mesh to be at the root's position, so local (0,0,0) is correct
          // if the mesh geometry is centered at origin.
          // If not, we can adjust by offset.
          // Let's just keep (0,0,0) for now and see.
          
          // Also remove any skeleton/bones references to avoid skinning
          if (mesh.isSkinnedMesh) {
            mesh.skeleton = null;
            mesh.bindMatrix.identity();
            mesh.bindMatrixInverse.identity();
          }
          // Remove morph targets
          if (mesh.morphTargetInfluences) {
            mesh.morphTargetInfluences.length = 0;
          }
        }
      });
      
      // --- 4. Apply base scale to the cleanRoot (so all meshes inherit scale) ---
      const scaleFactor = 0.017;
      cleanRoot.scale.set(scaleFactor, scaleFactor, scaleFactor);
      
      // --- 5. Center the model (optional) - we'll just center the root's position later ---
      // We can compute the bounding box of all meshes and shift the root so that the model is centered.
      // But since we want the actor's position to be where the model's feet are, we'll just use
      // the position from the original model's centering, if any. We'll skip for now.
      
      // --- 6. Apply the alabaster material ---
      const alabasterMat = new THREE.MeshStandardMaterial({
        color: 0xf5f0eb,
        roughness: 0.4,
        metalness: 0.0,
        emissive: new THREE.Color(0x222222),
        emissiveIntensity: 0.05,
      });
      
      cleanRoot.traverse((child) => {
        if (child.isMesh) {
          child.material = alabasterMat.clone();
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      
      console.log('✅ Brian is now flattened and ready!');
      return cleanRoot;
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
            // Clone the flattened model
            g = brianModel.clone(true);
            g.userData = { isBrian: true, actorId: it.id };
            scene.add(g);
            actorMeshes.set(it.id, g);
            console.log(`✅ Flattened Brian clone created for actor ${it.id}`);
          } else {
            console.warn(`⚠️ No Brian model – actor ${it.id} not rendered`);
            return;
          }
        }

        // --- Now move the root to the actor's world position ---
        const pos = worldToThree(it.x, it.y, 0);
        g.position.copy(pos);

        // --- Apply rotation (facing) to root ---
        const facingRad = it.facing * state.D2R;
        g.rotation.y = -facingRad + Math.PI / 2;

        // --- Scale: make lead actor bigger and spinning ---
        if (it.id === 1) {
          g.scale.set(0.017 * 3, 0.017 * 3, 0.017 * 3);
          g.rotation.y += 0.05; // spin
        } else {
          g.scale.set(0.017, 0.017, 0.017);
        }

        // --- Force matrix update ---
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

        console.log(`[sync] Actor ${it.id} at (${it.x.toFixed(2)}, ${it.y.toFixed(2)}) → root pos (${g.position.x.toFixed(2)}, ${g.position.y.toFixed(2)}, ${g.position.z.toFixed(2)})`);
        
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
