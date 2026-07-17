// ===== Progressive-enhancement 3D viewfinder =====
// Uses importmap to load three.js and GLTFLoader properly

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

  // Ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshStandardMaterial({ color: 0xe8e4df, roughness: 0.8 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Vignette walls
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

  // --- Load Brian model (alabaster) ---
  async function loadBrianModel() {
    const loader = new GLTFLoader();
    const url = './brian.glb';
    
    try {
      const gltf = await new Promise((resolve, reject) => {
        loader.load(url, resolve, undefined, reject);
      });
      
      const model = gltf.scene;
      
      // Scale Brian down
      const scaleFactor = 0.015;
      model.scale.set(scaleFactor, scaleFactor, scaleFactor);
      
      // Calculate bounding box to position feet on ground
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      
      // Move so feet are at y=0
      model.position.y = -center.y + (size.y / 2);
      
      console.log('✅ Brian loaded!');
      console.log('Brian size (meters):', size.x * scaleFactor, size.y * scaleFactor, size.z * scaleFactor);
      console.log('Brian center:', center.x, center.y, center.z);
      
      // Apply alabaster material
      const alabasterMat = new THREE.MeshStandardMaterial({
        color: 0xf5f0eb,
        roughness: 0.4,
        metalness: 0.0,
        emissive: new THREE.Color(0x222222),
        emissiveIntensity: 0.05,
        transparent: true,
        opacity: 0.98,
      });
      
      model.traverse((child) => {
        if (child.isMesh) {
          child.material = alabasterMat.clone();
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      
      return model;
    } catch (err) {
      console.error('Failed to load Brian model:', err);
      return null;
    }
  }

  // --- Build a detailed humanoid mannequin (fallback) ---
  function buildFallbackMannequin(it) {
    const group = new THREE.Group();
    const h = it.h;
    const w = it.w;
    
    const alabasterMat = new THREE.MeshStandardMaterial({
      color: 0xf5f0eb,
      roughness: 0.3,
      metalness: 0.0,
    });
    
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xf0e4d8,
      roughness: 0.4,
      metalness: 0.0,
    });
    
    // Head
    const headR = h * 0.065;
    const head = new THREE.Mesh(new THREE.SphereGeometry(headR, 16, 12), skinMat);
    head.position.y = h * 0.92;
    head.castShadow = true;
    group.add(head);
    
    // Neck
    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(headR * 0.5, headR * 0.6, h * 0.05, 8),
      skinMat
    );
    neck.position.y = h * 0.82;
    group.add(neck);
    
    // Torso
    const torso = new THREE.Mesh(
      new THREE.CylinderGeometry(w * 0.38, w * 0.28, h * 0.38, 10),
      alabasterMat
    );
    torso.position.y = h * 0.58;
    torso.castShadow = true;
    group.add(torso);
    
    // Shoulders
    const shoulder = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.7, h * 0.04, w * 0.2),
      alabasterMat
    );
    shoulder.position.set(0, h * 0.78, 0);
    group.add(shoulder);
    
    // Arms
    const armH = h * 0.3;
    const armR = w * 0.065;
    [-1, 1].forEach(side => {
      const arm = new THREE.Mesh(
        new THREE.CylinderGeometry(armR, armR * 0.7, armH, 8),
        skinMat
      );
      arm.position.set(side * (w * 0.45), h * 0.68, 0);
      arm.rotation.z = side * 0.1;
      arm.rotation.x = -0.1;
      arm.castShadow = true;
      group.add(arm);
      
      // Forearms
      const foreArm = new THREE.Mesh(
        new THREE.CylinderGeometry(armR * 0.7, armR * 0.5, armH * 0.7, 8),
        skinMat
      );
      foreArm.position.set(side * (w * 0.47), h * 0.48, 0);
      foreArm.rotation.z = side * 0.05;
      foreArm.castShadow = true;
      group.add(foreArm);
      
      // Hands
      const hand = new THREE.Mesh(
        new THREE.SphereGeometry(armR * 0.8, 6, 6),
        skinMat
      );
      hand.position.set(side * (w * 0.48), h * 0.38, 0);
      group.add(hand);
    });
    
    // Pelvis
    const pelvis = new THREE.Mesh(
      new THREE.CylinderGeometry(w * 0.3, w * 0.35, h * 0.06, 8),
      alabasterMat
    );
    pelvis.position.set(0, h * 0.38, 0);
    group.add(pelvis);
    
    // Legs
    const legH = h * 0.3;
    const legR = w * 0.1;
    [-1, 1].forEach(side => {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(legR, legR * 0.8, legH, 8),
        alabasterMat
      );
      leg.position.set(side * (w * 0.16), h * 0.25, 0);
      leg.castShadow = true;
      group.add(leg);
      
      const lowerLeg = new THREE.Mesh(
        new THREE.CylinderGeometry(legR * 0.8, legR * 0.6, legH * 0.85, 8),
        alabasterMat
      );
      lowerLeg.position.set(side * (w * 0.16), h * 0.08, 0);
      lowerLeg.castShadow = true;
      group.add(lowerLeg);
      
      const foot = new THREE.Mesh(
        new THREE.BoxGeometry(legR * 1.2, h * 0.03, legR * 2.0),
        alabasterMat
      );
      foot.position.set(side * (w * 0.16), 0.015, legR * 0.3);
      foot.castShadow = true;
      group.add(foot);
    });
    
    return group;
  }

  const actorMeshes = new Map();
  const propMeshes = new Map();
  let brianModel = null;

  // Try to load Brian once at startup
  loadBrianModel().then(model => {
    if (model) {
      brianModel = model;
      console.log('✅ Brian ready for use!');
      // Re-render to show Brian
      if (window.Previz3DRender) window.Previz3DRender();
    } else {
      console.warn('⚠️ Brian failed to load — using fallback mannequin');
    }
  });

  function syncItems() {
    const liveIds = new Set(state.items.map(i => i.id));
    actorMeshes.forEach((mesh, id) => { if (!liveIds.has(id)) { scene.remove(mesh); actorMeshes.delete(id); } });
    propMeshes.forEach((mesh, id) => { if (!liveIds.has(id)) { scene.remove(mesh); propMeshes.delete(id); } });

    state.items.forEach(it => {
      if (it.type === 'actor') {
        let g = actorMeshes.get(it.id);
        if (!g) {
          // If Brian loaded, use him; otherwise fallback
          if (brianModel) {
            // Clone Brian for each actor
            g = brianModel.clone();
          } else {
            g = buildFallbackMannequin(it);
          }
          scene.add(g);
          actorMeshes.set(it.id, g);
        }
        
        const pos = worldToThree(it.x, it.y, 0);
        g.position.copy(pos);
        const facingRad = it.facing * state.D2R;
        const lookTarget = worldToThree(it.x + Math.cos(facingRad), it.y + Math.sin(facingRad), 0);
        g.lookAt(lookTarget.x, g.position.y, lookTarget.z);
      } else {
        let m = propMeshes.get(it.id);
        if (!m) {
          const geo = new THREE.BoxGeometry(it.w, it.h, it.w * 0.7);
          const mat = new THREE.MeshStandardMaterial({ color: it.color, roughness: 0.7 });
          m = new THREE.Mesh(geo, mat);
          m.castShadow = true; m.receiveShadow = true;
          scene.add(m); propMeshes.set(it.id, m);
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
    resize();
    const cam = state.CAMS[state.active];
    const angles = state.fov(cam.lens);
    camera.fov = angles.v * 180 / Math.PI;
    camera.updateProjectionMatrix();
    camera.position.copy(worldToThree(cam.x, cam.y, cam.z));
    camera.lookAt(worldToThree(cam.aimX, cam.aimY, cam.aimZ));
    syncItems();
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

  const toggleChangeHandler = () => {
    const use3d = toggle.checked;
    canvas2d.style.display = use3d ? 'none' : 'block';
    canvas3d.style.display = use3d ? 'block' : 'none';
    if (use3d && window.Previz3DRender) {
      window.Previz3DRender();
    }
  };

  toggle.onchange = toggleChangeHandler;
  toggle.disabled = false;
  toggle.checked = true;
  
  canvas2d.style.display = 'none';
  canvas3d.style.display = 'block';
  
  setTimeout(() => {
    window.Previz3DRender();
  }, 100);
}

init3D();
