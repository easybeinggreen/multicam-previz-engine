// ===== Final loader for upright Brian (no rotations, just scale & ground) =====
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

  // Ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshStandardMaterial({ color: 0xe8e4df, roughness: 0.8 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Vignette panels (back walls)
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

  // --- Character model loading ---
  // MODEL_URLS maps a character's modelKey (set in app.js's CHARACTERS
  // config) to the .glb it should use. Elizabeth doesn't have her own
  // model yet, so her modelKey ("brian") points at the same file as
  // Brian's — when her real model exists, just add an "elizabeth" entry
  // here and switch her modelKey in app.js to match. Nothing else about
  // this loading/placement code needs to change.
  const MODEL_URLS = { brian: './Brian_Upright.glb' };
  const templateCache = new Map(); // modelKey -> {root, rawHeight} | null

  // Loads a model *unscaled* — height/grounding are applied per-actor at
  // clone time (see makeActorMesh), since different actors using the same
  // model (e.g. Brian and proxy-Elizabeth) can want different heights.
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

      root.traverse((child) => {
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

      console.log(`✅ "${modelKey}" template ready (alabaster, unscaled)`);
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

  // Builds a placed, correctly-grounded actor mesh at a given desired
  // height. Uses an outer "placement" group (world position/facing —
  // set every frame in syncItems) with the scaled, grounded model nested
  // as a child, so the ground offset survives the outer group's position
  // being overwritten each frame.
  function makeActorMesh(template, desiredHeight) {
    const placement = new THREE.Group();
    placement.userData = { isCharacter: true };
    if (template) {
      const model = template.root.clone(true);
      const scale = desiredHeight / template.rawHeight;
      model.scale.set(scale, scale, scale);
      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model);
      model.position.y = -box.min.y; // feet to ground, local to placement group
      placement.add(model);
    } else {
      // Fallback box (should rarely happen) — sized to this actor's height
      console.warn('⚠️ No character model – fallback box');
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

  // Preload the models referenced by the current items so the first
  // frame doesn't pop in late.
  await Promise.all(
    [...new Set(state.items.filter(i => i.type === 'actor').map(i => i.modelKey || 'brian'))]
      .map(getTemplate)
  );

  const actorMeshes = new Map();
  const propMeshes = new Map();
  window.__scene = scene;
  window.__meshes = actorMeshes;

  function syncItems() {
    const liveIds = new Set(state.items.map(i => i.id));
    
    // Remove old actors and props
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
          console.log(`➕ Added actor ${it.id} (${it.character || modelKey}, ${desiredHeight}m)`);

          // If this modelKey hasn't been loaded/cached yet, kick off the
          // load and swap the placeholder for the real model once ready.
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

        // Place at world position (feet already at ground)
        actorGroup.position.copy(worldToThree(it.x, it.y, 0));

        // Facing rotation (spins around world Y)
        const facingRad = it.facing * state.D2R;
        actorGroup.rotation.y = -facingRad - Math.PI / 2;

        actorGroup.updateMatrixWorld(true);
      } else {
        // Props (cuboid)
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

  // Initial sync and start render loop
  syncItems();
  requestAnimationFrame(frameLoop);
}

if (window.PrevizState) {
  init3D();
} else {
  window.addEventListener('previz-ready', init3D);
}
