// ===== Progressive-enhancement 3D viewfinder =====
// Reads camera/actor state from window.PrevizState (published by app.js) and
// renders it with three.js on a second canvas (#vf3d). If three.js can't be
// loaded (no network to the CDN) or WebGL can't be created (unsupported
// browser/GPU), this quietly does nothing and the existing 2D canvas (#vf)
// stays exactly as it was — nothing here can break the 2D viewfinder.
//
// Coordinate mapping: our world uses X/Y as the floor plane and Z as height.
// three.js uses Y as height. Mapped as (worldX, worldZ, -worldY) — the sign
// flip on Y keeps the mapping right-handed (checked by hand; see README).

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

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas3d, antialias: true });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // Expose renderer for debugging
    canvas3d.__renderer = renderer;
  } catch (err) {
    console.warn('3D viewfinder unavailable — WebGL could not initialise. Staying on 2D.', err);
    return;
  }

  const state = window.PrevizState;
  const scene = new THREE.Scene();
  // Paler background
  scene.background = new THREE.Color(0xf5f0eb);
  // Expose scene for debugging
  window.__threeScene = scene;
  
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 200);

  // Softer lighting
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xffeedd, 0.9);
  sun.position.set(8, 20, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -22; sun.shadow.camera.right = 22;
  sun.shadow.camera.top = 22; sun.shadow.camera.bottom = -22;
  sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 60;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0xccddff, 0.3);
  fill.position.set(-5, 10, -8);
  scene.add(fill);

  // Ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshStandardMaterial({ color: 0xe8e4df, roughness: 0.8 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Vignette wall panels — paler purple
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

  // Build a more human-like mannequin
  function buildMannequin(it) {
    const g = new THREE.Group();
    
    const skinColor = 0xf5d6c6;
    const shirtColor = it.color || 0x4a90d9;
    const pantsColor = 0x3d3d3d;
    const shoeColor = 0x2a2a2a;
    
    const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.7 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.8 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.9 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: shoeColor, roughness: 0.9 });

    const h = it.h;
    const w = it.w;
    
    // Torso
    const torso = new THREE.Mesh(
      new THREE.CylinderGeometry(w * 0.35, w * 0.28, h * 0.45, 8),
      shirtMat
    );
    torso.position.y = h * 0.55;
    torso.castShadow = true;
    g.add(torso);

    // Head
    const headR = h / 13;
    const head = new THREE.Mesh(new THREE.SphereGeometry(headR, 16, 12), skinMat);
    head.position.y = h - headR * 0.9;
    head.castShadow = true;
    g.add(head);

    // Neck
    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(headR * 0.5, headR * 0.6, h * 0.06, 8),
      skinMat
    );
    neck.position.y = h * 0.78;
    g.add(neck);

    // Nose
    const nose = new THREE.Mesh(
      new THREE.SphereGeometry(headR * 0.12, 6, 6),
      new THREE.MeshStandardMaterial({ color: 0xe8c4a8, roughness: 0.9 })
    );
    nose.position.set(0, h - headR * 0.7, -headR * 0.9);
    g.add(nose);

    // Legs
    const legH = h * 0.4;
    const legR = w * 0.1;
    [-1, 1].forEach(side => {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(legR, legR * 0.85, legH, 8),
        pantsMat
      );
      leg.position.set(side * w * 0.15, legH / 2, 0);
      leg.castShadow = true;
      g.add(leg);
      
      const shoe = new THREE.Mesh(
        new THREE.BoxGeometry(legR * 1.3, h * 0.04, legR * 2.2),
        shoeMat
      );
      shoe.position.set(side * w * 0.15, 0.02, legR * 0.3);
      shoe.castShadow = true;
      g.add(shoe);
    });

    // Arms
    const armH = h * 0.38;
    const armR = w * 0.06;
    [-1, 1].forEach(side => {
      const arm = new THREE.Mesh(
        new THREE.CylinderGeometry(armR, armR * 0.8, armH, 8),
        skinMat
      );
      arm.position.set(side * w * 0.48, h * 0.65, 0);
      arm.rotation.z = side * 0.15;
      arm.castShadow = true;
      g.add(arm);
    });

    // Shoulders
    const shoulder = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.6, h * 0.04, w * 0.2),
      shirtMat
    );
    shoulder.position.set(0, h * 0.78, 0);
    g.add(shoulder);

    return g;
  }

  const actorMeshes = new Map();
  const propMeshes = new Map();

  function syncItems() {
    const liveIds = new Set(state.items.map(i => i.id));
    actorMeshes.forEach((mesh, id) => { if (!liveIds.has(id)) { scene.remove(mesh); actorMeshes.delete(id); } });
    propMeshes.forEach((mesh, id) => { if (!liveIds.has(id)) { scene.remove(mesh); propMeshes.delete(id); } });

    state.items.forEach(it => {
      if (it.type === 'actor') {
        let g = actorMeshes.get(it.id);
        if (!g) { g = buildMannequin(it); scene.add(g); actorMeshes.set(it.id, g); }
        const pos = worldToThree(THREE, it.x, it.y, 0);
        g.position.copy(pos);
        const facingRad = it.facing * state.D2R;
        const lookTarget = worldToThree(THREE, it.x + Math.cos(facingRad), it.y + Math.sin(facingRad), 0);
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
        m.position.copy(worldToThree(THREE, it.x, it.y, it.h / 2));
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