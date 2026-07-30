// ===== Multicam Previz Engine =====
// Core constants
const SW = 24.6, SH = 13.8;         // Sony F5500 Super35 sensor mm
const R_AUDIENCE = 14.5;            // seating/room boundary radius (m) — 95'2" diameter — CONFIRMED from source PDF

// ⚠ PLACEHOLDER — real walkway width to be confirmed with Tony. 2.4m chosen as a safer
// performer/camera walkway clearance (typ. 1.2–2.4m for in-the-round staging; the narrower
// 1.8m first pass read as too tight once rendered — bumped up rather than shrinking the
// audience circle, since that 95'2" figure is a confirmed, likely load-bearing number).
const WALKWAY_WIDTH_M = 2.4;
const R_WALL = R_AUDIENCE + WALKWAY_WIDTH_M;   // mouth radius (m) — where recesses start & touch each other

// ⚠ PLACEHOLDER — recess depth. Per Paul: less critical than the walkway width, since the
// source PDF's 12'6" label conflates recess depth with walkway width and can't be trusted directly.
const VIGNETTE_DEPTH_M = 3.0;
const R_BACK = R_WALL + VIGNETTE_DEPTH_M;      // back-wall radius (m)

// Two-tier height: bottom = actual recess (unique art per vignette), top = flush flat panel
// sitting at R_WALL (not recessed), matching the source elevation sketch.
const VIGNETTE_LOWER_H = 3.05;   // 10'0" — recessed zone
const VIGNETTE_UPPER_H = 3.05;   // 10'0" — flush panel above
const VIGNETTE_TOTAL_H = VIGNETTE_LOWER_H + VIGNETTE_UPPER_H; // 6.1m

const D2R = Math.PI / 180;

// Unit helper
function toFeetInches(m) {
  const ft = m * 3.28084;
  const feet = Math.floor(ft);
  const inches = Math.round((ft - feet) * 12);
  return `${m.toFixed(2)}m (${feet}'${inches}")`;
}

// pt(angle, radius) returns world point with origin at V3 base (0,0,0)
// (offset is an arbitrary coordinate convention — shifting it doesn't move anything visually,
// since ROOM_CENTER shifts by the same amount and all rendering is relative to it)
function pt(angleDeg, radius) {
  const rad = angleDeg * D2R;
  return { x: radius * Math.cos(rad), y: radius * Math.sin(rad) - R_WALL };
}
const ROOM_CENTER = { x: 0, y: -R_WALL };

// Vignette centre angles
const V = { V1: 155, V2: 122, V3: 90, V4: 57, V5: 24 };
const VIGNETTE_ORDER = ['V1', 'V2', 'V3', 'V4', 'V5'];

// Boundary angles between neighbouring vignettes (the angular midpoint = where mouths touch),
// plus outer half-span for V1/V5's outer edge (~half the average inter-vignette spacing,
// which lines up with the source README's ~171°/8° overall arc).
const OUTER_HALF_SPAN_DEG = 16;
const VIGNETTE_BOUNDS = {};
{
  const angles = VIGNETTE_ORDER.map(k => V[k]);
  VIGNETTE_ORDER.forEach((name, i) => {
    const leftEdge = i === 0 ? angles[i] + OUTER_HALF_SPAN_DEG : (angles[i] + angles[i - 1]) / 2;
    const rightEdge = i === VIGNETTE_ORDER.length - 1 ? angles[i] - OUTER_HALF_SPAN_DEG : (angles[i] + angles[i + 1]) / 2;
    VIGNETTE_BOUNDS[name] = [leftEdge, rightEdge];
  });
}

// Rectangular recess footprint per vignette: mouth corners on the R_WALL circle (these are the
// points that touch the neighbouring vignette's mouth corner), projected straight back along the
// vignette's own centre-angle direction to the back wall. Adjacent recesses touch at frontR/frontL
// but diverge behind that point, leaving the wedge of solid wall Paul described.
function vignetteFootprint(name) {
  const ang = V[name];
  const [aL, aR] = VIGNETTE_BOUNDS[name];
  const frontL = pt(aL, R_WALL);
  const frontR = pt(aR, R_WALL);
  const dir = { x: Math.cos(ang * D2R), y: Math.sin(ang * D2R) };
  const backL = { x: frontL.x + dir.x * VIGNETTE_DEPTH_M, y: frontL.y + dir.y * VIGNETTE_DEPTH_M };
  const backR = { x: frontR.x + dir.x * VIGNETTE_DEPTH_M, y: frontR.y + dir.y * VIGNETTE_DEPTH_M };
  return { frontL, frontR, backL, backR, angle: ang };
}
const VIGNETTE_FOOTPRINTS = {};
VIGNETTE_ORDER.forEach(k => { VIGNETTE_FOOTPRINTS[k] = vignetteFootprint(k); });

const VIGNETTE_COLORS = { V1: '#aaccff', V2: '#ffdd99', V3: '#99dd99', V4: '#ff99cc', V5: '#cc99ff' };

// Stage marks — mid-depth inside the recess (where a performer would actually stand)
const STAGE_MARKS = {};
Object.keys(V).forEach(k => { STAGE_MARKS[k] = pt(V[k], R_WALL + VIGNETTE_DEPTH_M / 2); });

// Targets
const TARGETS = {
  "Room centre": () => ({ x: ROOM_CENTER.x, y: ROOM_CENTER.y }),
  "Origin (V3 base)": () => ({ x: 0, y: 0 }),
  "Vignette1": () => STAGE_MARKS.V1,
  "Vignette2": () => STAGE_MARKS.V2,
  "Vignette3": () => STAGE_MARKS.V3,
  "Vignette4": () => STAGE_MARKS.V4,
  "Vignette5": () => STAGE_MARKS.V5,
  "Vignette1-2": () => pt((V.V1 + V.V2) / 2, R_WALL + VIGNETTE_DEPTH_M / 2),
  "Vignette4-5": () => pt((V.V4 + V.V5) / 2, R_WALL + VIGNETTE_DEPTH_M / 2)
};

// Camera table
const CAMS = {
  "CAM1 Flung Rail": { type: "track", path: [pt(251, 14.6), pt(281, 14.6)], z: 1.0, lens: 35, aim: "Room centre", aimX: ROOM_CENTER.x, aimY: ROOM_CENTER.y, aimZ: 1.6 },
  "CAM2 Long V1": { type: "fixed", x: pt(332, 17.7).x, y: pt(332, 17.7).y, z: 1.2, lens: 200, aim: "Vignette1", aimX: STAGE_MARKS.V1.x, aimY: STAGE_MARKS.V1.y, aimZ: 1.6 },
  "CAM3 Agito V1-2": { type: "track", path: [pt(316, 17.5), pt(328, 17.5)], z: 1.1, lens: 70, aim: "Vignette1-2", aimX: TARGETS["Vignette1-2"]().x, aimY: TARGETS["Vignette1-2"]().y, aimZ: 1.6 },
  "CAM4 Long V2": { type: "fixed", x: pt(311, 17.4).x, y: pt(311, 17.4).y, z: 1.2, lens: 200, aim: "Vignette2", aimX: STAGE_MARKS.V2.x, aimY: STAGE_MARKS.V2.y, aimZ: 1.6 },
  "CAM5 Long V3": { type: "fixed", x: pt(270.5, 20.4).x, y: pt(270.5, 20.4).y, z: 1.2, lens: 200, aim: "Vignette3", aimX: STAGE_MARKS.V3.x, aimY: STAGE_MARKS.V3.y, aimZ: 1.6 },
  "CAM6 Wide V3": { type: "fixed", x: pt(266, 20.5).x, y: pt(266, 20.5).y, z: 1.2, lens: 60, aim: "Vignette3", aimX: STAGE_MARKS.V3.x, aimY: STAGE_MARKS.V3.y, aimZ: 1.6 },
  "CAM7 Long V4": { type: "fixed", x: pt(233, 17.7).x, y: pt(233, 17.7).y, z: 1.2, lens: 200, aim: "Vignette4", aimX: STAGE_MARKS.V4.x, aimY: STAGE_MARKS.V4.y, aimZ: 1.6 },
  "CAM8 Agito V4-5": { type: "track", path: [pt(215, 17.5), pt(227, 17.5)], z: 1.1, lens: 70, aim: "Vignette4-5", aimX: TARGETS["Vignette4-5"]().x, aimY: TARGETS["Vignette4-5"]().y, aimZ: 1.6 },
  "CAM9 Long V5": { type: "fixed", x: pt(207, 18.2).x, y: pt(207, 18.2).y, z: 1.2, lens: 200, aim: "Vignette5", aimX: STAGE_MARKS.V5.x, aimY: STAGE_MARKS.V5.y, aimZ: 1.6 },
  "CAM10 Mag Track": { type: "track", path: [pt(48, 7.3), pt(58, 7.3)], z: 1.6, lens: 24, aim: "Room centre", aimX: ROOM_CENTER.x, aimY: ROOM_CENTER.y, aimZ: 1.6 },
  "CAM11 Steadicam": { type: "track", path: [pt(155, 14.2), pt(185, 14.2)], z: 1.6, lens: 24, aim: "Room centre", aimX: ROOM_CENTER.x, aimY: ROOM_CENTER.y, aimZ: 1.6 },
  "CAM12 Ladder": { type: "fixed", x: 0, y: ROOM_CENTER.y, z: 4.5, lens: 35, aim: "Origin (V3 base)", aimX: 0, aimY: 0, aimZ: 1.6 }
};
Object.keys(CAMS).forEach(k => {
  const c = CAMS[k];
  if (c.type === "track") {
    c.trackPos = 0.5;
    c.x = c.path[0].x + (c.path[1].x - c.path[0].x) * 0.5;
    c.y = c.path[0].y + (c.path[1].y - c.path[0].y) * 0.5;
  }
});

// Character presets
// 👈 UPDATED: Female now uses "elizabeth"
const CHARACTERS = {
  male: { label: "Male actor", height: 1.8, color: "#378ADD", modelKey: "brian" },
  female: { label: "Female actor", height: 1.7, color: "#B565D8", modelKey: "elizabeth" }
};

// Initial items
// 👈 UPDATED: Female actor now uses modelKey: "elizabeth"
let items = [
  { id: 1, type: "actor", label: "Male actor", x: STAGE_MARKS.V3.x, y: STAGE_MARKS.V3.y, z: 0, w: 0.7, d: 0.4, h: 1.8, facing: 270, color: "#378ADD", standAt: "V3", character: "male", modelKey: "brian" },
  { id: 2, type: "actor", label: "Female actor", x: STAGE_MARKS.V2.x, y: STAGE_MARKS.V2.y, z: 0, w: 0.65, d: 0.4, h: 1.7, facing: 212, color: "#B565D8", standAt: "V2", character: "female", modelKey: "elizabeth" },
  { id: 3, type: "prop", label: "Table", x: STAGE_MARKS.V3.x + 2, y: STAGE_MARKS.V3.y, z: 0, w: 1.4, h: 0.9, color: "#FAC775" }
];

let active = Object.keys(CAMS)[0], activeActor = items[0].id, dragging = null, draggingAim = false, panning = false, panStart = null;
let viewZoom = 1, viewPanX = 0, viewPanY = 0;

// ---------- UI wiring ----------
const sel = document.getElementById('cs');
Object.keys(CAMS).forEach(k => { const o = document.createElement('option'); o.value = k; o.innerText = k; sel.appendChild(o); });
sel.onchange = e => { active = e.target.value; syncControls(); render(); };

const aimSel = document.getElementById('aimpreset');
const customOpt = document.createElement('option'); customOpt.value = "Custom"; customOpt.innerText = "Custom (dragged)"; customOpt.disabled = true; aimSel.appendChild(customOpt);
Object.keys(TARGETS).forEach(k => { const o = document.createElement('option'); o.value = k; o.innerText = k; aimSel.appendChild(o); });
aimSel.onchange = e => { const c = CAMS[active]; const t = TARGETS[e.target.value](); c.aim = e.target.value; c.aimX = t.x; c.aimY = t.y; render(); };

const slider = document.getElementById('fs');
slider.oninput = e => { CAMS[active].lens = +e.target.value; document.getElementById('fv').innerText = e.target.value + "mm"; render(); };

const azSlider = document.getElementById('azs');
azSlider.oninput = e => { CAMS[active].aimZ = +e.target.value; document.getElementById('az').innerText = toFeetInches(+e.target.value); render(); };

const chzSlider = document.getElementById('chzs');
chzSlider.max = 12;
chzSlider.oninput = e => { CAMS[active].z = +e.target.value; document.getElementById('chz').innerText = toFeetInches(+e.target.value); render(); };

const tpSlider = document.getElementById('tps');
tpSlider.oninput = e => {
  const c = CAMS[active];
  c.trackPos = +e.target.value;
  c.x = c.path[0].x + (c.path[1].x - c.path[0].x) * c.trackPos;
  c.y = c.path[0].y + (c.path[1].y - c.path[0].y) * c.trackPos;
  document.getElementById('tpv').innerText = Math.round(c.trackPos * 100) + "%";
  render();
};

const standSel = document.getElementById('standat');
Object.keys(STAGE_MARKS).forEach(k => { const o = document.createElement('option'); o.value = k; o.innerText = "Vignette " + k.slice(1); standSel.appendChild(o); });
standSel.onchange = e => {
  const a = curActor(); if (!a) return;
  const mark = STAGE_MARKS[e.target.value];
  a.x = mark.x; a.y = mark.y; a.standAt = e.target.value;
  render();
};

function getActorCounts() {
  let male = 0, female = 0;
  items.forEach(i => {
    if (i.type === 'actor') {
      if (i.character === 'male') male++;
      else if (i.character === 'female') female++;
    }
  });
  return { male, female };
}

document.getElementById('addActor').onchange = e => {
  const choice = e.target.value;
  if (!choice) return;
  const conf = CHARACTERS[choice];
  const counts = getActorCounts();
  let count = choice === 'male' ? counts.male + 1 : counts.female + 1;
  const label = conf.label + " " + count;

  const keys = Object.keys(STAGE_MARKS);
  const markKey = keys[Math.floor(Math.random() * keys.length)];
  const mark = STAGE_MARKS[markKey];
  items.push({
    id: Date.now(),
    type: "actor",
    label: label,
    x: mark.x,
    y: mark.y,
    z: 0,
    w: 0.7,
    d: 0.4,
    h: conf.height,
    facing: 270,
    color: conf.color,
    standAt: markKey,
    character: choice,
    modelKey: conf.modelKey
  });
  activeActor = items[items.length - 1].id;
  syncActorSel();
  render();
  e.target.value = "";
};

document.getElementById('deleteActor').onclick = () => {
  if (!activeActor) return;
  const idx = items.findIndex(i => i.id === activeActor && i.type === 'actor');
  if (idx === -1) return;
  items.splice(idx, 1);
  const remaining = items.filter(i => i.type === 'actor');
  activeActor = remaining.length > 0 ? remaining[0].id : null;
  syncActorSel();
  render();
};

const actorSel = document.getElementById('actorsel');
function syncActorSel() {
  actorSel.innerHTML = '';
  const actors = items.filter(i => i.type === 'actor');
  actors.forEach(a => { const o = document.createElement('option'); o.value = a.id; o.innerText = a.label; actorSel.appendChild(o); });
  if (actors.length > 0 && !actors.some(a => a.id === activeActor)) {
    activeActor = actors[0].id;
  }
  actorSel.value = activeActor || '';
  syncActorFields();
}
actorSel.onchange = e => { activeActor = +e.target.value; syncActorFields(); };
function curActor() { return items.find(i => i.id === activeActor && i.type === 'actor'); }
function syncActorFields() {
  const a = curActor();
  const ah = document.getElementById('ah');
  const standAt = document.getElementById('standat');
  const faces = document.getElementById('faces');
  if (!a) {
    ah.value = '';
    standAt.value = '';
    faces.value = 0;
    document.getElementById('facev').innerText = '—';
    return;
  }
  document.getElementById('faces').value = a.facing;
  document.getElementById('facev').innerText = a.facing + "°";
  ah.value = a.h;
  standAt.value = a.standAt || "V3";
}
document.getElementById('faces').oninput = e => {
  const a = curActor();
  if (!a) return;
  a.facing = +e.target.value;
  document.getElementById('facev').innerText = e.target.value + "°";
  render();
};
document.getElementById('ah').onchange = e => {
  const a = curActor();
  if (!a) return;
  a.h = +e.target.value;
  render();
};

function syncControls() {
  const c = CAMS[active];
  slider.value = c.lens;
  document.getElementById('fv').innerText = c.lens + "mm";
  chzSlider.value = c.z; document.getElementById('chz').innerText = toFeetInches(c.z);
  azSlider.value = c.aimZ; document.getElementById('az').innerText = toFeetInches(c.aimZ);
  aimSel.value = c.aim;
  document.getElementById('camtype').innerText = c.type === "track" ? "Track camera — position below" : "Fixed position";
  document.getElementById('trackrow').style.display = c.type === "track" ? "block" : "none";
  if (c.type === "track") { tpSlider.value = c.trackPos; document.getElementById('tpv').innerText = Math.round(c.trackPos * 100) + "%"; }
}

function updateDistance() {
  const c = CAMS[active];
  const a = curActor();
  const distEl = document.getElementById('distval');
  if (!distEl || !a) { distEl.innerText = "—"; return; }
  const dx = c.x - a.x, dy = c.y - a.y, dz = c.z - a.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  distEl.innerText = toFeetInches(dist);
}

// ---------- Colour helpers ----------
function shade(hex, percent) {
  const num = parseInt(hex.slice(1), 16);
  let r = (num >> 16) + Math.round(2.55 * percent);
  let g = ((num >> 8) & 0xff) + Math.round(2.55 * percent);
  let b = (num & 0xff) + Math.round(2.55 * percent);
  r = Math.min(255, Math.max(0, r)); g = Math.min(255, Math.max(0, g)); b = Math.min(255, Math.max(0, b));
  return "#" + r.toString(16).padStart(2, '0') + g.toString(16).padStart(2, '0') + b.toString(16).padStart(2, '0');
}

// ---------- 3D camera math ----------
function norm(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function fov(f) { return { h: 2 * Math.atan(SW / (2 * f)), v: 2 * Math.atan(SH / (2 * f)) }; }
function camBasis(c) {
  const fwd = norm([c.aimX - c.x, c.aimY - c.y, c.aimZ - c.z]);
  const right = norm(cross(fwd, [0, 0, 1]));
  const up = cross(right, fwd);
  return { fwd, right, up };
}
function project(c, basis, angles, w, h, px, py, pz) {
  const rel = [px - c.x, py - c.y, pz - c.z];
  const zc = dot(rel, basis.fwd);
  if (zc <= 0.05) return null;
  const xc = dot(rel, basis.right), yc = dot(rel, basis.up);
  const ndx = (xc / zc) / Math.tan(angles.h / 2);
  const ndy = (yc / zc) / Math.tan(angles.v / 2);
  return { x: w / 2 + ndx * w / 2, y: h / 2 - ndy * h / 2, depth: zc };
}

function render() { updateDistance(); drawFP(); drawVF(); if (window.Previz3DRender) window.Previz3DRender(); }

// ---------- Floor plan (with accurate seating) ----------
function drawFP() {
  const cv = document.getElementById('fp'), ctx = cv.getContext('2d');
  const dpr = window.devicePixelRatio || 1, rect = cv.getBoundingClientRect();
  cv.width = rect.width * dpr; cv.height = rect.height * dpr; ctx.scale(dpr, dpr);
  const w = rect.width, h = rect.height; ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);
  const baseScale = Math.min(w, h) / (2 * 20);
  const scale = baseScale * viewZoom;
  const cx = w / 2 + viewPanX, cy = h / 2 + viewPanY;
  const toPx = (x, y) => ({ x: cx + (x - ROOM_CENTER.x) * scale, y: cy - (y - ROOM_CENTER.y) * scale });
  const fromPx = (px, py) => ({ x: (px - cx) / scale + ROOM_CENTER.x, y: ROOM_CENTER.y - (py - cy) / scale });
  window._fpT = { toPx, fromPx };

  // ---- Seating geometry ----
  const centreX = 0, centreY = -R_WALL;
  const radius = R_AUDIENCE;

  // Walkway boundaries (in metres) – user provided: -21ft to -15ft and +15ft to +21ft
  const leftWalkwayLeft = -6.401;   // -21ft
  const leftWalkwayRight = -4.572;  // -15ft
  const rightWalkwayLeft = 4.572;   // +15ft
  const rightWalkwayRight = 6.401;  // +21ft

  // Stage cut‑out: remove seats above (closer to stage) a chord 12ft back from the frontmost point
  const frontY = centreY + radius;  // -3.66m (front edge of the circle)
  const cutY = frontY - 3.66;       // -7.32m (12ft back)

  // Back limit: the backmost point of the circle
  const backY = centreY - radius;   // -32.66m

  // Seat dimensions
  const seatWidth = 0.45;
  const seatDepth = 0.6;

 // ---- Stage cut‑out area (removed) ----
/*
const dyCut = cutY - centreY;
const chordX = Math.sqrt(radius * radius - dyCut * dyCut);
const angle1 = Math.atan2(dyCut, -chordX);
const angle2 = Math.atan2(dyCut, chordX);
ctx.beginPath();
ctx.moveTo(toPx(-chordX, cutY).x, toPx(-chordX, cutY).y);
ctx.arc(toPx(centreX, centreY).x, toPx(centreX, centreY).y, radius * scale, angle1, angle2, true);
ctx.closePath();
ctx.fillStyle = "rgba(100, 150, 255, 0.15)";
ctx.strokeStyle = "#4488ff";
ctx.lineWidth = 2;
ctx.fill();
*/


  // ---- Draw seats ----
  ctx.fillStyle = "#c9c9cf";
  ctx.strokeStyle = "#999";
  ctx.lineWidth = 0.5;

  let y = backY;
  while (y <= cutY) {
    const dy = y - centreY;
    const r2 = radius * radius - dy * dy;
    if (r2 <= 0) { y += seatDepth; continue; }
    const xCirc = Math.sqrt(r2);
    const leftBound = -xCirc;
    const rightBound = xCirc;

    // Define block boundaries
    const leftBlockStart = leftBound;
    const leftBlockEnd = leftWalkwayLeft;
    const centreBlockStart = leftWalkwayRight;
    const centreBlockEnd = rightWalkwayLeft;
    const rightBlockStart = rightWalkwayRight;
    const rightBlockEnd = rightBound;

    function drawBlock(start, end, yPos) {
      if (end <= start) return;
      const width = end - start;
      const numSeats = Math.floor(width / seatWidth);
      if (numSeats <= 0) return;
      const seatW = width / numSeats;
      for (let s = 0; s < numSeats; s++) {
        const x = start + s * seatW + seatW * 0.08;
        const p1 = toPx(x, yPos);
        const p2 = toPx(x + seatW * 0.8, yPos - seatDepth * 0.55);
        const ww = Math.abs(p2.x - p1.x);
        const hh = Math.abs(p2.y - p1.y);
        if (ww < 1 || hh < 1) continue;
        ctx.fillRect(Math.min(p1.x, p2.x), Math.min(p1.y, p2.y), ww, hh);
        ctx.strokeRect(Math.min(p1.x, p2.x), Math.min(p1.y, p2.y), ww, hh);
      }
    }

    drawBlock(leftBlockStart, leftBlockEnd, y);
    drawBlock(centreBlockStart, centreBlockEnd, y);
    drawBlock(rightBlockStart, rightBlockEnd, y);

    y += seatDepth;
  }

  // ---- Draw stage floor / walkway (ring from R_AUDIENCE to R_WALL) ----
  ctx.fillStyle = "#e8e4df";
  ctx.strokeStyle = "#d0ccc6";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, R_WALL * scale, 0, 7);
  ctx.arc(cx, cy, R_AUDIENCE * scale, 0, 7, true);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // ---- Audience circle (dashed) ----
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = "#aaa";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, R_AUDIENCE * scale, 0, 7);
  ctx.stroke();
  ctx.setLineDash([]);

  // ---- Blue margin ----
  ctx.strokeStyle = "#2196F3";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, R_AUDIENCE * scale, 0, 7);
  ctx.stroke();

  // ---- Vignette recesses: wedge infill first (solid wall between recesses), then recess polygons ----
  ctx.fillStyle = "#cfcac2";
  ctx.strokeStyle = "#b5afa6";
  ctx.lineWidth = 1;
  for (let i = 0; i < VIGNETTE_ORDER.length - 1; i++) {
    const a = VIGNETTE_FOOTPRINTS[VIGNETTE_ORDER[i]], b = VIGNETTE_FOOTPRINTS[VIGNETTE_ORDER[i + 1]];
    const shared = toPx(a.frontR.x, a.frontR.y);
    const backA = toPx(a.backR.x, a.backR.y);
    const backB = toPx(b.backL.x, b.backL.y);
    ctx.beginPath();
    ctx.moveTo(shared.x, shared.y);
    ctx.lineTo(backA.x, backA.y);
    ctx.lineTo(backB.x, backB.y);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  }

  VIGNETTE_ORDER.forEach(name => {
    const fp = VIGNETTE_FOOTPRINTS[name];
    const pts = [fp.frontL, fp.frontR, fp.backR, fp.backL].map(p => toPx(p.x, p.y));
    ctx.fillStyle = VIGNETTE_COLORS[name];
    ctx.strokeStyle = "#6C5CE7"; ctx.lineWidth = 2;
    ctx.beginPath();
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.closePath(); ctx.fill(); ctx.stroke();

    const midBack = { x: (fp.backL.x + fp.backR.x) / 2, y: (fp.backL.y + fp.backR.y) / 2 };
    const labelPos = toPx(midBack.x, midBack.y);
    ctx.fillStyle = "#4b3fb0"; ctx.font = "bold 10px monospace"; ctx.textAlign = "center";
    ctx.fillText(name, labelPos.x, labelPos.y);
  });
  ctx.lineWidth = 1;

  // ---- Origin marker (red dot) ----
  const originPx = toPx(0, 0);
  ctx.fillStyle = "#D8433B";
  ctx.beginPath(); ctx.arc(originPx.x, originPx.y, 5, 0, 7); ctx.fill();

  // ---- Cameras ----
  Object.keys(CAMS).forEach(k => {
    const c = CAMS[k], p = toPx(c.x, c.y);
    if (c.type === "track") {
      const p0 = toPx(c.path[0].x, c.path[0].y), p1 = toPx(c.path[1].x, c.path[1].y);
      ctx.strokeStyle = "#aaa"; ctx.setLineDash([3, 2]);
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.fillStyle = k === active ? "#0F9D74" : "#8a8a8a";
    ctx.beginPath(); ctx.arc(p.x, p.y, k === active ? 6 : 4, 0, 7); ctx.fill();
    ctx.fillStyle = "#333"; ctx.font = "9px monospace"; ctx.textAlign = "left"; ctx.fillText(k.split(' ')[0], p.x + 6, p.y + 3);
    if (k === active) {
      const aimPx = toPx(c.aimX, c.aimY);
      window._aimPx = aimPx;
      ctx.strokeStyle = "rgba(15,157,116,0.7)"; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(aimPx.x, aimPx.y); ctx.stroke(); ctx.setLineDash([]);
      // Larger aim crosshair
      ctx.strokeStyle = "#0F9D74"; ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(aimPx.x - 10, aimPx.y); ctx.lineTo(aimPx.x + 10, aimPx.y);
      ctx.moveTo(aimPx.x, aimPx.y - 10); ctx.lineTo(aimPx.x, aimPx.y + 10);
      ctx.stroke();
      ctx.lineWidth = 1;
      const angles = fov(c.lens);
      const camAngle = Math.atan2(c.aimY - c.y, c.aimX - c.x);
      ctx.fillStyle = "rgba(15,157,116,0.10)";
      ctx.beginPath(); ctx.moveTo(p.x, p.y);
      const range = 400;
      ctx.lineTo(p.x + Math.cos(camAngle - angles.h / 2) * range, p.y - Math.sin(camAngle - angles.h / 2) * range);
      ctx.lineTo(p.x + Math.cos(camAngle + angles.h / 2) * range, p.y - Math.sin(camAngle + angles.h / 2) * range);
      ctx.closePath(); ctx.fill();
    }
  });

  // ---- Items (actors & props) ----
  items.forEach(it => {
    const p = toPx(it.x, it.y);
    if (it.type === "actor") {
      const rx = Math.max((it.w / 2) * scale, 2), ry = Math.max((it.d / 2) * scale, 1.4);
      let rotation = -it.facing * D2R - Math.PI / 2;
// Brian's model is rotated 90° clockwise relative to the arrow system
if (it.modelKey === 'brian') {
  rotation -= Math.PI / 2; // subtract 90° to match his 3D facing
}
ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(rotation);
      ctx.fillStyle = it.color; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = it.id === activeActor ? 2 : 0.5; ctx.stroke();
      // Arrow points forward (towards facing direction) – fixed
      ctx.fillStyle = "#333";
      ctx.beginPath();
      ctx.moveTo(rx + 5, 0);
      ctx.lineTo(rx - 2, -3);
      ctx.lineTo(rx - 2, 3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = it.color; ctx.setLineDash([2, 2]); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = "#222"; ctx.font = "bold 9px monospace"; ctx.textAlign = "left"; ctx.fillText(it.label, p.x + 11, p.y + 3);
    } else {
      const trueR = Math.max((it.w / 2) * scale, 2.5);
      ctx.fillStyle = it.color; ctx.beginPath(); ctx.arc(p.x, p.y, trueR, 0, 7); ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = it === dragging ? 2 : 0.5; ctx.stroke();
      ctx.strokeStyle = it.color; ctx.setLineDash([2, 2]);
      ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = "#222"; ctx.font = "9px monospace"; ctx.textAlign = "left"; ctx.fillText(it.label, p.x + 11, p.y + 3);
    }
  });
}

// ---------- Viewfinder background: floor grid + vignette backdrops ----------
function drawFloorGrid(ctx, c, basis, angles, w, h) {
  ctx.strokeStyle = "rgba(0,0,0,0.08)"; ctx.lineWidth = 1;
  for (let x = -16; x <= 16; x += 4) {
    ctx.beginPath(); let started = false;
    for (let y = -30; y <= 15; y += 2) {
      const p = project(c, basis, angles, w, h, x, y, 0);
      if (!p) { started = false; continue; }
      if (!started) { ctx.moveTo(p.x, p.y); started = true; } else { ctx.lineTo(p.x, p.y); }
    }
    ctx.stroke();
  }
  for (let y = -30; y <= 15; y += 4) {
    ctx.beginPath(); let started = false;
    for (let x = -16; x <= 16; x += 2) {
      const p = project(c, basis, angles, w, h, x, y, 0);
      if (!p) { started = false; continue; }
      if (!started) { ctx.moveTo(p.x, p.y); started = true; } else { ctx.lineTo(p.x, p.y); }
    }
    ctx.stroke();
  }
}
function drawVignettePanels(ctx, c, basis, angles, w, h) {
  VIGNETTE_ORDER.forEach(name => {
    const fp = VIGNETTE_FOOTPRINTS[name];
    const proj = (p, z) => project(c, basis, angles, w, h, p.x, p.y, z);

    const backL0 = proj(fp.backL, 0), backR0 = proj(fp.backR, 0);
    const backLh = proj(fp.backL, VIGNETTE_LOWER_H), backRh = proj(fp.backR, VIGNETTE_LOWER_H);
    const frontL0 = proj(fp.frontL, 0), frontR0 = proj(fp.frontR, 0);
    const frontLh = proj(fp.frontL, VIGNETTE_LOWER_H), frontRh = proj(fp.frontR, VIGNETTE_LOWER_H);
    const frontLtop = proj(fp.frontL, VIGNETTE_TOTAL_H), frontRtop = proj(fp.frontR, VIGNETTE_TOTAL_H);
    if (!backL0 || !backR0 || !backLh || !backRh || !frontL0 || !frontR0 || !frontLh || !frontRh) return;

    ctx.fillStyle = "rgba(108,92,231,0.18)"; ctx.strokeStyle = "rgba(108,92,231,0.55)";
    // Back wall
    ctx.beginPath(); ctx.moveTo(backL0.x, backL0.y); ctx.lineTo(backR0.x, backR0.y); ctx.lineTo(backRh.x, backRh.y); ctx.lineTo(backLh.x, backLh.y); ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Side walls
    ctx.beginPath(); ctx.moveTo(frontL0.x, frontL0.y); ctx.lineTo(backL0.x, backL0.y); ctx.lineTo(backLh.x, backLh.y); ctx.lineTo(frontLh.x, frontLh.y); ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(frontR0.x, frontR0.y); ctx.lineTo(backR0.x, backR0.y); ctx.lineTo(backRh.x, backRh.y); ctx.lineTo(frontRh.x, frontRh.y); ctx.closePath(); ctx.stroke();
    // Upper flush panel
    if (frontLtop && frontRtop) {
      ctx.beginPath(); ctx.moveTo(frontLh.x, frontLh.y); ctx.lineTo(frontRh.x, frontRh.y); ctx.lineTo(frontRtop.x, frontRtop.y); ctx.lineTo(frontLtop.x, frontLtop.y); ctx.closePath(); ctx.stroke();
    }

    ctx.fillStyle = "#4b3fb0"; ctx.font = "10px monospace"; ctx.textAlign = "center";
    ctx.fillText(name, (backL0.x + backR0.x) / 2, (backLh.y + backL0.y) / 2);
  });
}

// ---------- Viewfinder ----------
function drawVF() {
  const cv = document.getElementById('vf'), ctx = cv.getContext('2d');
  const dpr = window.devicePixelRatio || 1, rect = cv.getBoundingClientRect();
  cv.width = rect.width * dpr; cv.height = rect.height * dpr; ctx.scale(dpr, dpr);
  const w = rect.width, h = rect.height; ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);
  const c = CAMS[active], basis = camBasis(c), angles = fov(c.lens);
  drawFloorGrid(ctx, c, basis, angles, w, h);
  drawVignettePanels(ctx, c, basis, angles, w, h);

  let closestActor = null, closestDepth = Infinity;
  const withDepth = items.map(it => {
    const base = project(c, basis, angles, w, h, it.x, it.y, it.z);
    return base ? { it, depth: base.depth } : null;
  }).filter(Boolean).sort((a, b) => b.depth - a.depth);

  withDepth.forEach(({ it, depth }) => {
    if (it.type === 'actor' && depth < closestDepth) {
      closestDepth = depth;
      closestActor = it;
    }
  });

  withDepth.forEach(({ it }) => {
    const base = project(c, basis, angles, w, h, it.x, it.y, it.z);
    const top = project(c, basis, angles, w, h, it.x, it.y, it.z + it.h);
    if (!base || !top) return;

    if (it.type === "actor") {
      const bearing = Math.atan2(c.y - it.y, c.x - it.x) / D2R;
      let rel = bearing - it.facing;
      while (rel > 180) rel -= 360;
      while (rel < -180) rel += 360;
      const relRad = rel * D2R;
      const apparent = Math.abs(it.w * Math.cos(relRad)) + Math.abs(it.d * Math.sin(relRad));
      const pw = (apparent / base.depth) / Math.tan(angles.h / 2) * (w / 2);
      const ph = base.y - top.y;

      ctx.save(); ctx.globalAlpha = 0.18; ctx.fillStyle = "#000";
      ctx.beginPath(); ctx.ellipse(base.x, base.y + 1, pw * 0.6, pw * 0.16, 0, 0, 7); ctx.fill();
      ctx.restore();

      const headDiam = ph / 7.5;
      const headR = headDiam / 2;
      const headCenterY = top.y + headR;
      const neckW = pw * 0.32;
      const shoulderY = top.y + headDiam + headR * 0.4;

      const bodyGrad = ctx.createLinearGradient(base.x - pw / 2, shoulderY, base.x + pw / 2, base.y);
      bodyGrad.addColorStop(0, shade(it.color, 18));
      bodyGrad.addColorStop(1, shade(it.color, -12));
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.moveTo(base.x - neckW / 2, headCenterY + headR * 0.6);
      ctx.lineTo(base.x + neckW / 2, headCenterY + headR * 0.6);
      ctx.lineTo(base.x + pw / 2, shoulderY);
      ctx.lineTo(base.x + pw / 2, base.y);
      ctx.lineTo(base.x - pw / 2, base.y);
      ctx.lineTo(base.x - pw / 2, shoulderY);
      ctx.closePath(); ctx.fill();

      const headGrad = ctx.createRadialGradient(base.x - headR * 0.3, headCenterY - headR * 0.3, headR * 0.1, base.x, headCenterY, headR * 1.3);
      headGrad.addColorStop(0, "#fbe3c4"); headGrad.addColorStop(1, "#dcb488");
      ctx.fillStyle = headGrad;
      ctx.beginPath(); ctx.arc(base.x, headCenterY, headR, 0, 7); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.15)"; ctx.stroke();

      if (Math.abs(rel) < 60) {
        ctx.fillStyle = "#2a2a2a";
        ctx.beginPath(); ctx.arc(base.x - headR * 0.35, headCenterY - headR * 0.1, headR * 0.12, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(base.x + headR * 0.35, headCenterY - headR * 0.1, headR * 0.12, 0, 7); ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.beginPath(); ctx.moveTo(base.x, headCenterY + headR * 0.1); ctx.lineTo(base.x, headCenterY + headR * 0.4); ctx.stroke();
      } else if (Math.abs(rel) > 120) {
        ctx.strokeStyle = "rgba(0,0,0,0.25)";
        for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(base.x + i * headR * 0.3, headCenterY - headR * 0.9); ctx.lineTo(base.x + i * headR * 0.3, headCenterY - headR * 0.1); ctx.stroke(); }
      } else {
        const side = rel > 0 ? 1 : -1;
        ctx.fillStyle = "#2a2a2a"; ctx.beginPath(); ctx.arc(base.x + side * headR * 0.4, headCenterY, headR * 0.1, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.moveTo(base.x + side * headR * 0.7, headCenterY + headR * 0.05); ctx.lineTo(base.x + side * headR * 0.95, headCenterY + headR * 0.15); ctx.lineTo(base.x + side * headR * 0.7, headCenterY + headR * 0.25); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = "#222"; ctx.font = "9px monospace"; ctx.textAlign = "center"; ctx.fillText(it.label, base.x, base.y + 11);
    } else {
      const left = project(c, basis, angles, w, h, it.x - it.w / 2, it.y, it.z);
      const rightp = project(c, basis, angles, w, h, it.x + it.w / 2, it.y, it.z);
      if (!left || !rightp) return;
      const pw = Math.abs(rightp.x - left.x);
      const ph = base.y - top.y;
      ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.fillStyle = it.color;
      ctx.fillRect(base.x - pw / 2, top.y, pw, ph); ctx.strokeRect(base.x - pw / 2, top.y, pw, ph);
      ctx.fillStyle = "#222"; ctx.font = "9px monospace"; ctx.textAlign = "center"; ctx.fillText(it.label, base.x, base.y + 11);
    }
  });

  document.getElementById('hcam').innerText = active.split(' ')[0];
  document.getElementById('hlens').innerText = c.lens + "mm";
  let scaleLbl = "Extreme wide (EWS)";
  if (closestActor) {
    const base = project(c, basis, angles, w, h, closestActor.x, closestActor.y, closestActor.z);
    const top = project(c, basis, angles, w, h, closestActor.x, closestActor.y, closestActor.z + closestActor.h);
    if (base && top) {
      const headFrac = (base.y - top.y) / h;
      if (headFrac > 1.2) scaleLbl = "Extreme close-up (ECU)";
      else if (headFrac > 0.8) scaleLbl = "Close-up (CU)";
      else if (headFrac > 0.4) scaleLbl = "Medium (MS)";
      else if (headFrac > 0.15) scaleLbl = "Medium wide (MWS)";
    }
  }
  document.getElementById('hscale').innerText = "Closest actor: " + scaleLbl;
}

// ---------- Floor plan interaction ----------
const fpCanvas = document.getElementById('fp');

fpCanvas.addEventListener('mousedown', e => {
  const r = fpCanvas.getBoundingClientRect();
  const mx = e.clientX - r.left, my = e.clientY - r.top;
  if (!window._fpT) return;
  const { toPx, fromPx } = window._fpT;

  // 1. Check if click is on the aim marker (larger hit area)
  if (window._aimPx && Math.hypot(mx - window._aimPx.x, my - window._aimPx.y) < 20) {
    draggingAim = true;
    return;
  }

  // 2. Check if click is on a camera
  for (const [k, c] of Object.entries(CAMS)) {
    const p = toPx(c.x, c.y);
    if (Math.hypot(mx - p.x, my - p.y) < 15) {
      active = k;
      sel.value = k;
      syncControls();
      render();
      return;
    }
  }

  // 3. Otherwise, try dragging items or panning
  const wc = fromPx(mx, my);
  for (const it of items) {
    if (Math.hypot(it.x - wc.x, it.y - wc.y) < 0.8) {
      dragging = it;
      if (it.type === "actor") { activeActor = it.id; syncActorSel(); }
      render();
      return;
    }
  }
  panning = true;
  panStart = { mx, my, panX: viewPanX, panY: viewPanY };
});

fpCanvas.addEventListener('mousemove', e => {
  const r = fpCanvas.getBoundingClientRect();
  const mx = e.clientX - r.left, my = e.clientY - r.top;
  if (draggingAim) {
    const wc = window._fpT.fromPx(mx, my);
    CAMS[active].aimX = wc.x; CAMS[active].aimY = wc.y; CAMS[active].aim = "Custom"; aimSel.value = "Custom";
    render(); return;
  }
  if (dragging) {
    const wc = window._fpT.fromPx(mx, my);
    dragging.x = wc.x; dragging.y = wc.y;
    if (dragging.type === "actor") dragging.standAt = null;
    render(); return;
  }
  if (panning) {
    viewPanX = panStart.panX + (mx - panStart.mx);
    viewPanY = panStart.panY + (my - panStart.my);
    render();
  }
});
window.addEventListener('mouseup', () => { dragging = null; draggingAim = false; panning = false; render(); });
fpCanvas.addEventListener('wheel', e => {
  e.preventDefault();
  viewZoom = Math.min(4, Math.max(0.4, viewZoom * (e.deltaY < 0 ? 1.1 : 0.9)));
  render();
}, { passive: false });

// ---------- Initialise ----------
syncActorSel(); syncControls(); render();
window.addEventListener('resize', render);

// ---------- State for 3D ----------
window.PrevizState = {
  CAMS, items, V, VIGNETTE_ORDER, D2R, pt, fov,
  get active() { return active; },
  // ---- Recess geometry exports for 3D ----
  R_AUDIENCE: R_AUDIENCE,
  R_WALL: R_WALL,
  R_BACK: R_BACK,
  WALKWAY_WIDTH_M: WALKWAY_WIDTH_M,
  VIGNETTE_DEPTH_M: VIGNETTE_DEPTH_M,
  VIGNETTE_LOWER_H: VIGNETTE_LOWER_H,
  VIGNETTE_UPPER_H: VIGNETTE_UPPER_H,
  VIGNETTE_TOTAL_H: VIGNETTE_TOTAL_H,
  VIGNETTE_BOUNDS: VIGNETTE_BOUNDS,
  VIGNETTE_FOOTPRINTS: VIGNETTE_FOOTPRINTS,
  VIGNETTE_COLORS: VIGNETTE_COLORS,
  ROOM_CENTER: ROOM_CENTER,
  leftWalkwayLeft: -6.401,
  leftWalkwayRight: -4.572,
  rightWalkwayLeft: 4.572,
  rightWalkwayRight: 6.401,
  cutY: -7.32,   // frontY - 3.66
  seatWidth: 0.45,
  seatDepth: 0.6,
  audienceFloorZ: -1.14  // -3'9"
};
window.dispatchEvent(new Event('previz-ready'));
