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
  } catch (err) {
    console.warn('3D viewfinder unavailable — WebGL could not initialise. Staying on 2D.', err);
    return;
  }

  const state = window.PrevizState;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 200);

  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(8, 20, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -22; sun.shadow.camera.right = 22;
  sun.shadow.camera.top = 22; sun.shadow.camera.bottom = -22;
  sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 60;
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshStandardMaterial({ color: 0xf1f1f3 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Vignette wall panels
  Object.entries(state.V).forEach(([name, ang]) => {
    const rad = ang * state.D2R;
    const center = state.pt(ang, state.R_VIGNETTE);
    const geo = new THREE.PlaneGeometry(state.VIGNETTE_WIDTH_M, state.VIGNETTE_HEIGHT_M);
    const mat = new THREE.MeshStandardMaterial({ color: 0x8f84e8, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(worldToThree(THREE, center.x, center.y, state.VIGNETTE_HEIGHT_M / 2));
    // Look at a point further outward (away from room centre) so the panel's
    // front face ends up facing inward, toward the audience/cameras.
    const outward = worldToThree(THREE, center.x + Math.cos(rad) * 5, center.y + Math.sin(rad) * 5, state.VIGNETTE_HEIGHT_M / 2);
    mesh.lookAt(outward);
    mesh.receiveShadow = true;
    scene.add(mesh);
  });

  function buildMannequin(it) {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: it.color });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xf2d3ae });

    const torsoH = it.h * 0.45;
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(it.w / 2.4, torsoH, 4, 8), bodyMat);
    torso.position.y = it.h * 0.55;
    torso.castShadow = true;
    g.add(torso);

    const headR = it.h / 15;
    const head = new THREE.Mesh(new THREE.SphereGeometry(headR, 16, 12), skinMat);
    head.position.y = it.h - headR;
    head.castShadow = true;
    g.add(head);
    // Nose bump at local -Z, our defined "front" before facing rotation
    const nose = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.18, 8, 8), skinMat);
    nose.position.set(0, it.h - headR, -headR * 0.9);
    g.add(nose);

    const legH = it.h * 0.45;
    [-1, 1].forEach(side => {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(it.w * 0.14, legH, 4, 8), bodyMat);
      leg.position.set(side * it.w * 0.18, legH / 2, 0);
      leg.castShadow = true;
      g.add(leg);
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(it.w * 0.11, torsoH * 0.85, 4, 8), bodyMat);
      arm.position.set(side * (it.w / 2 + it.w * 0.12), it.h * 0.55, 0);
      arm.castShadow = true;
      g.add(arm);
    });
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
          const mat = new THREE.MeshStandardMaterial({ color: it.color });
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

  // Initialisation succeeded — enable the toggle and switch to 3D by default
  // Define the onchange handler first
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
  
  // Manually show 3D canvas and render
  canvas2d.style.display = 'none';
  canvas3d.style.display = 'block';
  
  // Small delay to ensure the canvas is visible before rendering
  setTimeout(() => {
    window.Previz3DRender();
  }, 50);
}

// Module scripts execute after deferred/classic scripts have already run, so
// PrevizState usually already exists by the time we get here — but listen
// for the ready event too, in case script execution order ever changes.
if (window.PrevizState) { init3D(); } else { window.addEventListener('previz-ready', init3D); }