// ===== Progressive-enhancement 3D viewfinder with Brian model =====
// Loads a realistic human model (Brian from Mixamo) and renders it as
// an alabaster (white stone) mannequin.

function worldToThree(THREE, x, y, z) { return new THREE.Vector3(x, z, -y); }

async function init3D() {
  const canvas3d = document.getElementById('vf3d');
  const toggle = document.getElementById('use3d');
  const canvas2d = document.getElementById('vf');
  if (!canvas3d || !toggle) return;

  let THREE;
  try {
    THREE = await import('https://unpkg.com/three@0.160.0/build/three.module.js');
  } catch (err) {
    console.warn('3D viewfinder unavailable — three.js failed to load from CDN. Staying on 2D.', err);
    return;
  }

  // Load GLTFLoader for the Brian model
  let GLTFLoader;
  try {
    const module = await import('https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js');
    GLTFLoader = module.GLTFLoader;
  } catch (err) {
    console.warn('GLTFLoader not available, falling back to basic mannequins.', err);
    return;
  }

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

  // Better lighting for alabaster look
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
    mesh.position.copy(worldToThree(THREE, center.x, center.y, state.VIGNETTE_HEIGHT_M / 2));
    const outward = worldToThree(THREE, center.x + Math.cos(rad) * 5, center.y + Math.sin(rad) * 5, state.VIGNETTE_HEIGHT_M / 2);
    mesh.lookAt(outward);
    mesh.receiveShadow = true;
    scene.add(mesh);
  });

  // --- Load Brian model (alabaster) ---
  let modelCache = new Map();

  async function loadBrianModel(color) {
    const loader = new GLTFLoader();
    
    // You'll need to host Brian.glb somewhere accessible
    // Option 1: Place in the same folder as index.html and reference it
    // Option 2: Upload to GitHub and use the raw URL
    // Option 3: Use a CDN if you have one
    
    // IMPORTANT: Replace this URL with the actual location of your Brian.glb file
    const url = './brian.glb'; // <-- CHANGE THIS TO YOUR FILE PATH
    
    try {
      const gltf = await loader.loadAsync(url);
      const model = gltf.scene;
      
      // Scale the model to match our world units
      model.scale.set(0.8, 0.8, 0.8);
      
      // --- Apply alabaster material to everything ---
      // Alabaster color: warm white with slight translucency
      const alabasterMat = new THREE.MeshStandardMaterial({
        color: 0xf5f0eb,
        roughness: 0.4,
        metalness: 0.0,
        emissive: new THREE.Color(0x222222),
        emissiveIntensity: 0.05,
        // Slight subsurface effect (looks like stone)
        transparent: true,
        opacity: 0.98,
      });
      
      // Apply the alabaster material to all meshes in the model
      model.traverse((child) => {
        if (child.isMesh) {
          // Replace with alabaster material
          child.material = alabasterMat.clone();
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      
      return model;
    } catch (err) {
      console.error('Failed to load Brian model:', err);
      console.warn('Make sure brian.glb is in the same folder as index.html');
      console.warn('Or update the URL in the code to point to the correct location.');
      return null;
    }
  }

  const actorMeshes = new Map();
  const propMeshes = new Map();

  // Flag to track if models are loading
  let modelsLoading = false;
  let modelsLoaded = false;

  async function syncItems() {
    const liveIds = new Set(state.items.map(i => i.id));
    actorMeshes.forEach((mesh, id) => { if (!liveIds.has(id)) { scene.remove(mesh); actorMeshes.delete(id); } });
    propMeshes.forEach((mesh, id) => { if (!liveIds.has(id)) { scene.remove(mesh); propMeshes.delete(id); } });

    // Load models for each actor
    for (const it of state.items) {
      if (it.type === 'actor') {
        let g = actorMeshes.get(it.id);
        if (!g) {
          modelsLoading = true;
          const model = await loadBrianModel(it.color);
          modelsLoading = false;
          
          if (model) {
            modelsLoaded = true;
            g = model;
            scene.add(g);
            actorMeshes.set(it.id, g);
          } else {
            // Fallback to basic mannequin if model fails to load
            console.warn('Using fallback mannequin for actor', it.id);
            g = buildFallbackMannequin(it);
            scene.add(g);
            actorMeshes.set(it.id, g);
          }
        }
        
        if (g) {
          const pos = worldToThree(THREE, it.x, it.y, 0);
          g.position.copy(pos);
          const facingRad = it.facing * state.D2R;
          const lookTarget = worldToThree(THREE, it.x + Math.cos(facingRad), it.y + Math.sin(facingRad), 0);
          g.lookAt(lookTarget.x, g.position.y, lookTarget.z);
        }
      } else {
        let m = propMeshes.get(it.id);
        if (!m) {
          const geo = new THREE.BoxGeometry(it.w, it.h, it.w * 0.7);
          const mat = new THREE.MeshStandardMaterial({ color: it.color, roughness: 0.7 });
          m = new THREE.Mesh(geo, mat);
          m.castShadow = true; m.receiveShadow = true;
          scene.add(m); propMeshes.set(it.id, m);
        }
        m.position.copy(worldToThree(THREE, it.x, it.y, it.h / 2));
      }
    }
  }

  // Fallback mannequin if Brian doesn't load
  function buildFallbackMannequin(it) {
    const g = new THREE.Group();
    const h = it.h;
    const w = it.w;
    
    const alabasterMat = new THREE.MeshStandardMaterial({
      color: 0xf5f0eb,
      roughness: 0.3,
      metalness: 0.0,
    });
    
    // Simple geometric body
    const torso = new THREE.Mesh(
      new THREE.CylinderGeometry(w * 0.35, w * 0.25, h * 0.45, 8),
      alabasterMat
    );
    torso.position.y = h * 0.55;
    torso.castShadow = true;
    g.add(torso);
    
    const headR = h / 13;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(headR, 16, 12),
      alabasterMat
    );
    head.position.y = h - headR * 0.8;
    head.castShadow = true;
    g.add(head);
    
    return g;
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
    camera.position.copy(worldToThree(THREE, cam.x, cam.y, cam.z));
    camera.lookAt(worldToThree(THREE, cam.aimX, cam.aimY, cam.aimZ));
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
  }, 50);
}

if (window.PrevizState) { init3D(); } else { window.addEventListener('previz-ready', init3D); }