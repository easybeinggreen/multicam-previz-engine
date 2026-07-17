// ===== Multicam Previz Engine =====
// Core constants
const SW = 24.6, SH = 13.8;         // Sony F5500 Super35 sensor mm
const R_AUDIENCE = 14.5;            // seating/room boundary radius (m) — 95'2" diameter, vector-measured
const R_VIGNETTE = 16.4;            // vignette back-wall radius (m) — measured from the wall's own bezier path
const VIGNETTE_WIDTH_M = 9;         // 29'6"
const VIGNETTE_HEIGHT_M = 3.8;      // 12'6"
const D2R = Math.PI / 180;
// Angular half-width of each panel, derived from its true width and radius (not an arbitrary number)
const VIGNETTE_HALF_WIDTH_DEG = Math.asin((VIGNETTE_WIDTH_M / 2) / R_VIGNETTE) * 180 / Math.PI;

// pt(angle, radius) returns a world point shifted so that (0,0,0) sits at
// the front-base of Vignette 3 — the fixed physical reference mark for
// this venue (the middle of the 5 stage positions).
function pt(angleDeg, radius) {
  const rad = angleDeg * D2R;
  return { x: radius * Math.cos(rad), y: radius * Math.sin(rad) - R_VIGNETTE };
}
const ROOM_CENTER = { x: 0, y: -R_VIGNETTE };

// Vignette centre angles — measured directly from the wall's vector bezier
// path in Tony's PDF (171deg to 8deg span, divided into 5 equal panels).
const V = { V1: 155, V2: 122, V3: 90, V4: 57, V5: 24 };

// Stage marks — where a performer actually stands, 2m in front of the wall
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

// Camera table — angle/radius measured directly from the PDF's vector text
// and icon-image coordinates (not a rasterized guess). See README for method.
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

// Seating — three rectangular blocks, ~25 rows each, matching the plan's
// real layout (straight rectangular rows inside the circular room, not
// curved bands). Defined in room-centre-relative local coords, then shifted.
const SEAT_ROWS = 25;
const SEAT_Y_FRONT = -12, SEAT_Y_BACK = 13; // local, room-centre-relative
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
document.getElementById('faces').oninput = e => { curActor().facing = +e.target.value; document.getElementById('facev').innerText = e.target.value + "°"; render(); };
document.getElementById('ah').onchange = e => { curActor().h = +e.target.value; render(); };
document.getElementById('aw').onchange = e => { curActor().w = +e.target.value; render(); };
document.getElementById('ad').onchange = e => { curActor().d = +e.target.value; render(); };

function renderShots() { document.getElementById('shotlist').innerHTML = shots.map(s => `<div>${s}</div>`).join(''); }

function syncControls() {
  const c = CAMS[active];
  slider.value = c.lens;
  document.getElementById('fv').innerText = c.lens + "mm";
  chzSlider.value = c.z; document.getElementById('chz').innerText = c.z.toFixed(1) + "m";
  azSlider.value = c.aimZ; document.getElementById('az').innerText = c.aimZ.toFixed(1) + "m";
  aimSel.value = c.aim;
  document.getElementById('camtype').innerText = c.type === "track" ? "Track camera — position below" : "Fixed position";
  document.getElementById('trackrow').style.display = c.type === "track" ? "block" : "none";
  if (c.type === "track") { tpSlider.value = c.trackPos; document.getElementById('tpv').innerText = Math.round(c.trackPos * 100) + "%"; }
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

function render() { drawFP(); drawVF(); }

// ---------- Floor plan ----------
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

  ctx.strokeStyle = "#ccc"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, R_AUDIENCE * scale, 0, 7); ctx.stroke();

  // Seating — real rectangular blocks, ~25 rows
  ctx.fillStyle = "#c9c9cf"; ctx.strokeStyle = "#999";
  const rowStep = (SEAT_Y_BACK - SEAT_Y_FRONT) / SEAT_ROWS;
  SEAT_BLOCKS.forEach(block => {
    const blockW = block.xTo - block.xFrom;
    const seatW = blockW / block.seatsPerRow;
    for (let r = 0; r < SEAT_ROWS; r++) {
      const yLocal = SEAT_Y_FRONT + r * rowStep;
      const p = local(0, yLocal);
      for (let s = 0; s < block.seatsPerRow; s++) {
        const xL = block.xFrom + s * seatW + seatW * 0.08;
        const seatLocal = local(xL, yLocal);
        const p1 = toPx(seatLocal.x, seatLocal.y);
        const p2 = toPx(seatLocal.x + seatW * 0.8, seatLocal.y - rowStep * 0.55);
        const ww = Math.abs(p2.x - p1.x), hh = Math.abs(p2.y - p1.y);
        ctx.fillRect(Math.min(p1.x, p2.x), Math.min(p1.y, p2.y), Math.max(ww, 1), Math.max(hh, 1));
      }
    }
  });

  // Vignettes — contiguous arcs at the true wall radius, true angular width
  Object.entries(V).forEach(([name, ang]) => {
    const pts = [];
    for (let d = -VIGNETTE_HALF_WIDTH_DEG; d <= VIGNETTE_HALF_WIDTH_DEG; d += 2) pts.push(toPx(...Object.values(pt(ang + d, R_VIGNETTE))));
    ctx.strokeStyle = "#6C5CE7"; ctx.lineWidth = 6;
    ctx.beginPath(); pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)); ctx.stroke();
    const mid = toPx(...Object.values(pt(ang, R_VIGNETTE + 1.4)));
    ctx.fillStyle = "#4b3fb0"; ctx.font = "bold 10px monospace"; ctx.textAlign = "center"; ctx.fillText(name, mid.x, mid.y);
  });
  ctx.lineWidth = 1;

  // Origin marker
  const originPx = toPx(0, 0);
  ctx.fillStyle = "#D8433B";
  ctx.beginPath(); ctx.arc(originPx.x, originPx.y, 4, 0, 7); ctx.fill();
  ctx.strokeStyle = "#D8433B"; ctx.lineWidth = 1.5;
  const headEnd = toPx(2.5, 0);
  ctx.beginPath(); ctx.moveTo(originPx.x, originPx.y); ctx.lineTo(headEnd.x, headEnd.y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(headEnd.x, headEnd.y); ctx.lineTo(headEnd.x - 6, headEnd.y - 4); ctx.lineTo(headEnd.x - 6, headEnd.y + 4); ctx.closePath(); ctx.fillStyle = "#D8433B"; ctx.fill();
  ctx.fillStyle = "#D8433B"; ctx.font = "10px monospace"; ctx.textAlign = "left";
  ctx.fillText("0,0,0 — V3 base", originPx.x + 8, originPx.y - 8);
  ctx.font = "8px monospace"; ctx.fillText("0° reference", headEnd.x + 4, headEnd.y + 3);
  ctx.lineWidth = 1;

  // Cameras
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
      ctx.strokeStyle = "#0F9D74"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(aimPx.x - 7, aimPx.y); ctx.lineTo(aimPx.x + 7, aimPx.y);
      ctx.moveTo(aimPx.x, aimPx.y - 7); ctx.lineTo(aimPx.x, aimPx.y + 7); ctx.stroke(); ctx.lineWidth = 1;
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

  // Items
  items.forEach(it => {
    const p = toPx(it.x, it.y);
    if (it.type === "actor") {
      const rx = Math.max((it.w / 2) * scale, 2), ry = Math.max((it.d / 2) * scale, 1.4);
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(-it.facing * D2R);
      ctx.fillStyle = it.color; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = it.id === activeActor ? 2 : 0.5; ctx.stroke();
      ctx.fillStyle = "#333"; ctx.beginPath(); ctx.moveTo(rx + 5, 0); ctx.lineTo(rx - 2, -3); ctx.lineTo(rx - 2, 3); ctx.closePath(); ctx.fill();
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
  Object.entries(V).forEach(([name, ang]) => {
    const rad = ang * D2R;
    const center = pt(ang, R_VIGNETTE);
    const tx = -Math.sin(rad), ty = Math.cos(rad);
    const hw = VIGNETTE_WIDTH_M / 2, ht = VIGNETTE_HEIGHT_M;
    const bl = { x: center.x - tx * hw, y: center.y - ty * hw };
    const br = { x: center.x + tx * hw, y: center.y + ty * hw };
    const pbl = project(c, basis, angles, w, h, bl.x, bl.y, 0);
    const pbr = project(c, basis, angles, w, h, br.x, br.y, 0);
    const ptl = project(c, basis, angles, w, h, bl.x, bl.y, ht);
    const ptr = project(c, basis, angles, w, h, br.x, br.y, ht);
    if (!pbl || !pbr || !ptl || !ptr) return;
    ctx.fillStyle = "rgba(108,92,231,0.18)"; ctx.strokeStyle = "rgba(108,92,231,0.55)";
    ctx.beginPath(); ctx.moveTo(pbl.x, pbl.y); ctx.lineTo(pbr.x, pbr.y); ctx.lineTo(ptr.x, ptr.y); ctx.lineTo(ptl.x, ptl.y); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#4b3fb0"; ctx.font = "10px monospace"; ctx.textAlign = "center";
    ctx.fillText(name, (pbl.x + pbr.x) / 2, (ptl.y + pbl.y) / 2);
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

  let headFrac = 0;
  const withDepth = items.map(it => {
    const base = project(c, basis, angles, w, h, it.x, it.y, it.z);
    return base ? { it, depth: base.depth } : null;
  }).filter(Boolean).sort((a, b) => b.depth - a.depth);

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
      if (headFrac === 0) headFrac = ph / h;

      // Ground shadow
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
  if (headFrac > 1.2) scaleLbl = "Extreme close-up (ECU)";
  else if (headFrac > 0.8) scaleLbl = "Close-up (CU)";
  else if (headFrac > 0.4) scaleLbl = "Medium (MS)";
  else if (headFrac > 0.15) scaleLbl = "Medium wide (MWS)";
  document.getElementById('hscale').innerText = "Lead: " + scaleLbl;
}

// ---------- Floor plan interaction: drag aim, drag items, pan, zoom ----------
const fpCanvas = document.getElementById('fp');
fpCanvas.addEventListener('mousedown', e => {
  const r = fpCanvas.getBoundingClientRect();
  const mx = e.clientX - r.left, my = e.clientY - r.top;
  if (!window._fpT) return;
  if (window._aimPx && Math.hypot(mx - window._aimPx.x, my - window._aimPx.y) < 10) { draggingAim = true; return; }
  const wc = window._fpT.fromPx(mx, my);
  for (const it of items) {
    if (Math.hypot(it.x - wc.x, it.y - wc.y) < 0.8) { dragging = it; if (it.type === "actor") { activeActor = it.id; syncActorSel(); } return; }
  }
  panning = true; panStart = { mx, my, panX: viewPanX, panY: viewPanY };
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

syncActorSel(); syncControls(); render();
window.addEventListener('resize', render);
