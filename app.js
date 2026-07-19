// ===== Multicam Previz Engine =====
// Core constants
const SW = 24.6, SH = 13.8;
const R_AUDIENCE = 14.5;
const R_VIGNETTE = 16.4;
const VIGNETTE_WIDTH_M = 9;
const VIGNETTE_HEIGHT_M = 3.8;
const D2R = Math.PI / 180;
const VIGNETTE_HALF_WIDTH_DEG = Math.asin((VIGNETTE_WIDTH_M / 2) / R_VIGNETTE) * 180 / Math.PI;

function pt(angleDeg, radius) {
  const rad = angleDeg * D2R;
  return { x: radius * Math.cos(rad), y: radius * Math.sin(rad) - R_VIGNETTE };
}
const ROOM_CENTER = { x: 0, y: -R_VIGNETTE };

const V = { V1: 155, V2: 122, V3: 90, V4: 57, V5: 24 };

const STAGE_MARKS = {};
Object.keys(V).forEach(k => { STAGE_MARKS[k] = pt(V[k], R_VIGNETTE - 2); });

const TARGETS = {
  "Room centre": () => ({ x: ROOM_CENTER.x, y: ROOM_CENTER.y }),
  "Origin (V3 base)": () => ({ x: 0, y: 0 }),
  "Vignette1": () => pt(V.V1, R_VIGNETTE),
  "Vignette2": () => pt(V.V2, R_VIGNETTE),
  "Vignette3": () => pt(V.V3, R_VIGNETTE),
  "Vignette4": () => pt(V.V4, R_VIGNETTE),
  "Vignette5": () => pt(V.V5, R_VIGNETTE),
  "Vignette1-2": () => pt((V.V1 + V.V2) / 2, R_VIGNETTE),
  "Vignette4-5": () => pt((V.V4 + V.V5) / 2, R_VIGNETTE)
};

const CAMS = {
  "CAM1 Flung Rail": { type: "track", path: [pt(251, 14.6), pt(281, 14.6)], z: 1.0, lens: 35, aim: "Room centre", aimX: ROOM_CENTER.x, aimY: ROOM_CENTER.y, aimZ: 1.6 },
  "CAM2 Long V1": { type: "fixed", x: pt(332, 17.7).x, y: pt(332, 17.7).y, z: 1.2, lens: 200, aim: "Vignette1", aimX: pt(V.V1, R_VIGNETTE).x, aimY: pt(V.V1, R_VIGNETTE).y, aimZ: 1.6 },
  "CAM3 Agito V1-2": { type: "track", path: [pt(316, 17.5), pt(328, 17.5)], z: 1.1, lens: 70, aim: "Vignette1-2", aimX: TARGETS["Vignette1-2"]().x, aimY: TARGETS["Vignette1-2"]().y, aimZ: 1.6 },
  "CAM4 Long V2": { type: "fixed", x: pt(311, 17.4).x, y: pt(311, 17.4).y, z: 1.2, lens: 200, aim: "Vignette2", aimX: pt(V.V2, R_VIGNETTE).x, aimY: pt(V.V2, R_VIGNETTE).y, aimZ: 1.6 },
  "CAM5 Long V3": { type: "fixed", x: pt(270.5, 20.4).x, y: pt(270.5, 20.4).y, z: 1.2, lens: 200, aim: "Vignette3", aimX: pt(V.V3, R_VIGNETTE).x, aimY: pt(V.V3, R_VIGNETTE).y, aimZ: 1.6 },
  "CAM6 Wide V3": { type: "fixed", x: pt(266, 20.5).x, y: pt(266, 20.5).y, z: 1.2, lens: 60, aim: "Vignette3", aimX: pt(V.V3, R_VIGNETTE).x, aimY: pt(V.V3, R_VIGNETTE).y, aimZ: 1.6 },
  "CAM7 Long V4": { type: "fixed", x: pt(233, 17.7).x, y: pt(233, 17.7).y, z: 1.2, lens: 200, aim: "Vignette4", aimX: pt(V.V4, R_VIGNETTE).x, aimY: pt(V.V4, R_VIGNETTE).y, aimZ: 1.6 },
  "CAM8 Agito V4-5": { type: "track", path: [pt(215, 17.5), pt(227, 17.5)], z: 1.1, lens: 70, aim: "Vignette4-5", aimX: TARGETS["Vignette4-5"]().x, aimY: TARGETS["Vignette4-5"]().y, aimZ: 1.6 },
  "CAM9 Long V5": { type: "fixed", x: pt(207, 18.2).x, y: pt(207, 18.2).y, z: 1.2, lens: 200, aim: "Vignette5", aimX: pt(V.V5, R_VIGNETTE).x, aimY: pt(V.V5, R_VIGNETTE).y, aimZ: 1.6 },
  "CAM10 Mag Track": { type: "track", path: [pt(48, 7.3), pt(58, 7.3)], z: 1.6, lens: 24, aim: "Room centre", aimX: ROOM_CENTER.x, aimY: ROOM_CENTER.y, aimZ: 1.6 },
  "CAM11 Steadicam": { type: "track", path: [pt(155, 14.2), pt(185, 14.2)], z: 1.6, lens: 24, aim: "Room centre", aimX: ROOM_CENTER.x, aimY: ROOM_CENTER.y, aimZ: 1.6 },
  "CAM12 Ladder": { type: "fixed", x: 0, y: -R_VIGNETTE, z: 4.5, lens: 35, aim: "Room centre", aimX: ROOM_CENTER.x, aimY: ROOM_CENTER.y, aimZ: 1.6 }
};
Object.keys(CAMS).forEach(k => {
  const c = CAMS[k];
  if (c.type === "track") {
    c.trackPos = 0.5;
    c.x = c.path[0].x + (c.path[1].x - c.path[0].x) * 0.5;
    c.y = c.path[0].y + (c.path[1].y - c.path[0].y) * 0.5;
  }
});

const SEAT_ROWS = 25;
const SEAT_Y_FRONT = -12, SEAT_Y_BACK = 13;
const SEAT_BLOCKS = [
  { xFrom: -8, xTo: -4, seatsPerRow: 8 },
  { xFrom: -3, xTo: 3, seatsPerRow: 14 },
  { xFrom: 4, xTo: 8, seatsPerRow: 8 }
];
function local(x, yLocal) { return { x, y: yLocal - R_VIGNETTE }; }

let items = [
  { id: 1, type: "actor", label: "Lead actor", x: STAGE_MARKS.V3.x, y: STAGE_MARKS.V3.y, z: 0, w: 0.7, d: 0.4, h: 1.8, facing: 270, color: "#1D9E75", standAt: "V3" },
  { id: 2, type: "actor", label: "Support actor", x: STAGE_MARKS.V2.x, y: STAGE_MARKS.V2.y, z: 0, w: 0.65, d: 0.4, h: 1.7, facing: 302, color: "#D4537E", standAt: "V2" },
  { id: 3, type: "prop", label: "Table", x: STAGE_MARKS.V3.x + 2, y: STAGE_MARKS.V3.y, z: 0, w: 1.4, h: 0.9, color: "#FAC775" }
];

let active = Object.keys(CAMS)[0], activeActor = items[0].id, dragging = null, draggingAim = false, panning = false, panStart = null, shots = [];
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
azSlider.oninput = e => { CAMS[active].aimZ = +e.target.value; document.getElementById('az').innerText = (+e.target.value).toFixed(1) + "m"; render(); };

const chzSlider = document.getElementById('chzs');
chzSlider.oninput = e => { CAMS[active].z = +e.target.value; document.getElementById('chz').innerText = (+e.target.value).toFixed(1) + "m"; render(); };

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

document.getElementById('ba').onclick = () => {
  const id = Date.now();
  const keys = Object.keys(STAGE_MARKS);
  const markKey = keys[Math.floor(Math.random() * keys.length)];
  const mark = STAGE_MARKS[markKey];
  items.push({ id, type: "actor", label: "Actor", x: mark.x, y: mark.y, z: 0, w: 0.7, d: 0.4, h: 1.8, facing: 270, color: "#378ADD", standAt: markKey });
  activeActor = id; syncActorSel(); render();
};
document.getElementById('bt').onclick = () => {
  items.push({ id: Date.now(), type: "prop", label: "Table", x: ROOM_CENTER.x + (Math.random() - 0.5) * 6, y: ROOM_CENTER.y + (Math.random() - 0.5) * 10, z: 0, w: 1.4, h: 0.9, color: "#FAC775" });
  render();
};
document.getElementById('logbtn').onclick = () => {
  const n = document.getElementById('note').value || '(no note)';
  shots.push(`${active.split(' ')[0]} / ${CAMS[active].lens}mm / ${n}`);
  document.getElementById('note').value = '';
  renderShots();
};
document.getElementById('resetview').onclick = () => { viewZoom = 1; viewPanX = 0; viewPanY = 0; render(); };

const actorSel = document.getElementById('actorsel');
function syncActorSel() {
  actorSel.innerHTML = '';
  items.filter(i => i.type === "actor").forEach(a => { const o = document.createElement('option'); o.value = a.id; o.innerText = a.label; actorSel.appendChild(o); });
  actorSel.value = activeActor;
  syncActorFields();
}
actorSel.onchange = e => { activeActor = +e.target.value; syncActorFields(); };
function curActor() { return items.find(i => i.id === activeActor); }
function syncActorFields() {
  const a = curActor(); if (!a) return;
  document.getElementById('faces').value = a.facing; document.getElementById('facev').innerText = a.facing + "°";
  document.getElementById('ah').value = a.h; document.getElementById('aw').value = a.w; document.getElementById('ad').value = a.d;
  standSel.value = a.standAt || "V3";
}

// ---------- MISSING CONTINUATION (reconstructed) ----------
document.getElementById('faces').oninput = e => {
  const a = curActor(); if (!a) return;
  a.facing = +e.target.value;
  document.getElementById('facev').innerText = a.facing + "°";
  render();
};

document.getElementById('ah').oninput = e => { const a = curActor(); if (a) { a.h = +e.target.value; render(); } };
document.getElementById('aw').oninput = e => { const a = curActor(); if (a) { a.w = +e.target.value; render(); } };
document.getElementById('ad').oninput = e => { const a = curActor(); if (a) { a.d = +e.target.value; render(); } };

function syncControls() {
  const c = CAMS[active];
  document.getElementById('fs').value = c.lens;
  document.getElementById('fv').innerText = c.lens + "mm";
  document.getElementById('azs').value = c.aimZ;
  document.getElementById('az').innerText = c.aimZ.toFixed(1) + "m";
  document.getElementById('chzs').value = c.z;
  document.getElementById('chz').innerText = c.z.toFixed(1) + "m";
  
  if (c.type === "track") {
    document.getElementById('tps').disabled = false;
    document.getElementById('tps').value = c.trackPos;
    document.getElementById('tpv').innerText = Math.round(c.trackPos * 100) + "%";
  } else {
    document.getElementById('tps').disabled = true;
    document.getElementById('tpv').innerText = "N/A";
  }
  
  const aimMatch = Object.keys(TARGETS).find(k => {
    const t = TARGETS[k]();
    return Math.abs(t.x - c.aimX) < 0.01 && Math.abs(t.y - c.aimY) < 0.01;
  });
  document.getElementById('aimpreset').value = aimMatch || "Custom";
}

function renderShots() {
  const list = document.getElementById('shotlist');
  list.innerHTML = '';
  shots.forEach((s, i) => {
    const li = document.createElement('li');
    li.innerText = `${i + 1}. ${s}`;
    list.appendChild(li);
  });
}

// ---------- Canvas rendering ----------
const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');

function worldToScreen(wx, wy) {
  const scale = 18 * viewZoom; // pixels per meter
  return {
    x: canvas.width / 2 + (wx + viewPanX) * scale,
    y: canvas.height / 2 - (wy + viewPanY) * scale
  };
}

function screenToWorld(sx, sy) {
  const scale = 18 * viewZoom;
  return {
    x: (sx - canvas.width / 2) / scale - viewPanX,
    y: -(sy - canvas.height / 2) / scale - viewPanY
  };
}

function drawPolygon(ctx, pts, color, stroke) {
  ctx.beginPath();
  pts.forEach((p, i) => {
    const s = worldToScreen(p.x, p.y);
    if (i === 0) ctx.moveTo(s.x, s.y); else ctx.lineTo(s.x, s.y);
  });
  ctx.closePath();
  if (color) { ctx.fillStyle = color; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
}

function drawCircle(ctx, wx, wy, rM, color, stroke) {
  const s = worldToScreen(wx, wy);
  const scale = 18 * viewZoom;
  ctx.beginPath();
  ctx.arc(s.x, s.y, rM * scale, 0, Math.PI * 2);
  if (color) { ctx.fillStyle = color; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
}

function drawLine(ctx, w1, w2, color, width) {
  const s1 = worldToScreen(w1.x, w1.y);
  const s2 = worldToScreen(w2.x, w2.y);
  ctx.beginPath();
  ctx.moveTo(s1.x, s1.y);
  ctx.lineTo(s2.x, s2.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = width || 1;
  ctx.stroke();
}

function drawText(ctx, text, wx, wy, color, align) {
  const s = worldToScreen(wx, wy);
  ctx.fillStyle = color || "#fff";
  ctx.font = "11px sans-serif";
  ctx.textAlign = align || "center";
  ctx.fillText(text, s.x, s.y);
}

function render() {
  // Resize canvas
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Background
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Grid
  const scale = 18 * viewZoom;
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 0.5;
  for (let x = -20; x <= 20; x += 2) {
    const s1 = worldToScreen(x, -20);
    const s2 = worldToScreen(x, 20);
    ctx.beginPath(); ctx.moveTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y); ctx.stroke();
  }
  for (let y = -20; y <= 20; y += 2) {
    const s1 = worldToScreen(-20, y);
    const s2 = worldToScreen(20, y);
    ctx.beginPath(); ctx.moveTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y); ctx.stroke();
  }
  
  // Stage floor
  drawPolygon(ctx, [
    { x: -SW / 2, y: 0 },
    { x: SW / 2, y: 0 },
    { x: SW / 2, y: SH },
    { x: -SW / 2, y: SH }
  ], "#16213e", "#0f3460");
  
  // Vignette arc
  const vignettePts = [];
  for (let a = V.V5 - 5; a <= V.V1 + 5; a += 2) {
    vignettePts.push(pt(a, R_VIGNETTE));
  }
  drawPolygon(ctx, vignettePts, "#0f3460", "#e94560");
  
  // Vignette labels
  Object.keys(V).forEach(k => {
    const p = pt(V[k], R_VIGNETTE + 0.5);
    drawText(ctx, k, p.x, p.y, "#e94560");
  });
  
  // Stage marks
  Object.keys(STAGE_MARKS).forEach(k => {
    const m = STAGE_MARKS[k];
    drawCircle(ctx, m.x, m.y, 0.15, "#e94560", "#fff");
    drawText(ctx, k, m.x, m.y - 0.4, "#fff");
  });
  
  // Audience seats
  for (let row = 0; row < SEAT_ROWS; row++) {
    const t = row / (SEAT_ROWS - 1);
    const y = SEAT_Y_FRONT + t * (SEAT_Y_BACK - SEAT_Y_FRONT);
    SEAT_BLOCKS.forEach(block => {
      for (let s = 0; s < block.seatsPerRow; s++) {
        const st = s / (block.seatsPerRow - 1);
        const x = block.xFrom + st * (block.xTo - block.xFrom);
        drawCircle(ctx, x, y - R_VIGNETTE, 0.12, "#2a2a4a", "#444");
      }
    });
  }
  
  // Items (actors & props)
  items.forEach(item => {
    const s = worldToScreen(item.x, item.y);
    const w = item.w
