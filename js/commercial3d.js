/* Commercial flat-roof planner: a low-slope building in HD 3D. Pick the membrane and parapet,
   drop rooftop equipment on the roof, drag / rotate it, and see what it takes to make it work
   (edge clearance, curb spacing, drains, penetrations). Units are feet; +z faces the street. */
import * as THREE from "three";
import { OrbitControls } from "three/addons/OrbitControls.js";
import { createStage } from "./3d/stage.js";
import { trees } from "./3d/site.js";
import * as TX from "./3d/textures.js";

const $ = (s) => document.querySelector(s);
const canvas = $("#cmCanvas");
if (!canvas) throw new Error("no commercial canvas");
const mobile = matchMedia("(max-width: 899px)").matches;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

/* ---------- options ---------- */
const MEMBRANES = {
  tpo: { name: "TPO · white", hex: "#eef0ef", rough: 0.55, note: "Reflective single-ply, heat-welded seams. Lowers cooling costs." },
  pvc: { name: "PVC · grey", hex: "#b8bdc2", rough: 0.5, note: "Heat-welded single-ply that holds up to grease and chemicals: good for restaurants." },
  epdm: { name: "EPDM · black", hex: "#2a2c2f", rough: 0.85, note: "Synthetic rubber with taped seams. Long track record, absorbs heat." },
  modbit: { name: "Modified bitumen", hex: "#77736c", rough: 0.95, note: "Multi-ply asphalt system with a granulated cap sheet. Tough under foot traffic." },
};
const WALLS = {
  tilt: { name: "Tilt-up concrete", hex: "#cfccc5" },
  brick: { name: "Brick", hex: "#8a4a3a" },
  metal: { name: "Metal panel", hex: "#7c8590" },
};
const COPING = { white: "#e9e9e6", bronze: "#4b3a2c", black: "#1d1f22" };

// size: footprint [along x, along z] in feet; h: height; curb: sits on a flashed curb
const ITEMS = {
  rtu10: { name: "Rooftop unit · 10 ton", size: [11, 6.5], curb: true, note: "Packaged heating & cooling. Roughly 1,600 lb: needs a structural check, a factory curb flashed into the membrane, and service clearance on the access side." },
  rtu5: { name: "Rooftop unit · 5 ton", size: [8, 4.5], curb: true, note: "Roughly 900 lb on a factory curb. Keep the condenser side clear for airflow and service." },
  exhaust: { name: "Exhaust fan", size: [3, 3], curb: true, note: "Kitchen or restroom exhaust on a curb. Kitchen grease exhaust needs a grease guard so it doesn't eat the membrane." },
  skylight: { name: "Skylight", size: [4, 8], curb: true, note: "Curb at least 8 in above the roof. OSHA requires a screen or guard over skylights on walked roofs." },
  hatch: { name: "Roof hatch", size: [3, 3], curb: true, note: "Service access. A guardrail kit around the opening is recommended." },
  condenser: { name: "Condenser on sleepers", size: [4, 4], note: "Split-system condenser on sleepers and protection pads, never on bare membrane." },
  solar: { name: "Solar array · 12 panels", size: [20, 7], note: "Ballasted racks on protection pads. Check the roof's load rating and the membrane warranty before adding solar." },
  dish: { name: "Satellite dish", size: [3, 3], note: "Non-penetrating ballast mount on a protection pad." },
  pipe: { name: "Pipe vent", size: [1, 1], pen: true, note: "Plumbing vent flashed with a pre-molded boot or a pitch pocket." },
  walkway: { name: "Walkway pads · 20 ft", size: [3, 20], flat: true, note: "Protects the membrane on the path service techs walk to the equipment." },
  drain: { name: "Roof drain", size: [2, 2], flat: true, drain: true, note: "Low points where water leaves the roof. Equipment shouldn't sit on or crowd a drain." },
};

let B = { w: 120, d: 80, h: 22, parapet: 3.5, membrane: "tpo", wall: "tilt", coping: "white" };

/* ---------- stage ---------- */
const stage = createStage(canvas, { mobile, hd: true, dpr: mobile ? 1.5 : 1.75 });
const { scene, camera, renderer, sun } = stage;
camera.far = 5000; camera.updateProjectionMatrix();
const sc = sun.shadow.camera; sc.left = -170; sc.right = 170; sc.top = 170; sc.bottom = -170; sc.far = 700; sc.updateProjectionMatrix();
stage.setSun(42, -55, "day");
stage.usePhotoSky().then(request).catch(() => {});
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 30; controls.maxDistance = 600;
controls.addEventListener("change", request);

/* ---------- ground: parking lot, lawn, trees ---------- */
const ground = new THREE.Group();
scene.add(ground);
{
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshStandardMaterial({ map: TX.photo("lawn", { repeat: 90 }), color: "#7fa65a", roughness: 1 }));
  lawn.rotation.x = -Math.PI / 2; lawn.receiveShadow = true; ground.add(lawn);
  const lot = new THREE.Mesh(new THREE.PlaneGeometry(320, 300), new THREE.MeshStandardMaterial({ map: TX.photo("concrete", { repeat: 22 }), color: "#8f9295", roughness: 0.95 }));
  lot.rotation.x = -Math.PI / 2; lot.position.set(0, 0.05, 40); lot.receiveShadow = true; ground.add(lot);
  // parking stripes in front of the building
  const stripe = new THREE.MeshStandardMaterial({ color: "#f2f1ea", roughness: 0.8 });
  for (let i = -11; i <= 11; i++) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 18), stripe);
    s.rotation.x = -Math.PI / 2; s.position.set(i * 10, 0.08, 105); ground.add(s);
  }
  ground.add(trees([[-175, 20, 42, 30], [-170, -70, 50, 34], [175, 10, 40, 28], [168, -80, 48, 32], [-110, 215, 34, 26], [120, 220, 38, 28], [0, -190, 55, 40], [-90, -185, 46, 32], [95, -180, 50, 36]]));
}

/* ---------- the building ---------- */
const bld = new THREE.Group();
scene.add(bld);
const mats = {
  wall: new THREE.MeshStandardMaterial({ roughness: 0.9 }),
  membrane: new THREE.MeshStandardMaterial({ roughness: 0.6 }),
  coping: new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.5 }),
  glass: new THREE.MeshPhysicalMaterial({ color: "#2a3a48", roughness: 0.08, metalness: 0.2, reflectivity: 0.9, clearcoat: 1 }),
  mullion: new THREE.MeshStandardMaterial({ color: "#2b2e33", roughness: 0.4, metalness: 0.6 }),
  galv: new THREE.MeshStandardMaterial({ color: "#a9adb1", roughness: 0.45, metalness: 0.7 }),
  unit: new THREE.MeshStandardMaterial({ color: "#d9d6cf", roughness: 0.5, metalness: 0.2 }),
  dark: new THREE.MeshStandardMaterial({ color: "#2a2d31", roughness: 0.6, metalness: 0.3 }),
  louver: new THREE.MeshStandardMaterial({ color: "#8e939a", roughness: 0.5, metalness: 0.5 }),
  panel: new THREE.MeshPhysicalMaterial({ color: "#1b2740", roughness: 0.15, metalness: 0.4, clearcoat: 1 }),
  pad: new THREE.MeshStandardMaterial({ color: "#8b8e90", roughness: 1 }),
  dome: new THREE.MeshPhysicalMaterial({ color: "#e8f1f6", roughness: 0.15, transmission: 0.6, transparent: true, opacity: 0.8, thickness: 0.4 }),
  boot: new THREE.MeshStandardMaterial({ color: "#1c1c1c", roughness: 0.8 }),
};

// membrane rolls: faint lapped seams every 10 ft, so it reads as a real single-ply roof
function seamTexture() {
  const c = document.createElement("canvas"); c.width = 1024; c.height = 64;
  const g = c.getContext("2d");
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, 1024, 64);
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.035})`; g.fillRect(Math.random() * 1024, Math.random() * 64, 2, 2); }
  g.fillStyle = "rgba(0,0,0,.16)"; g.fillRect(0, 0, 1024, 2);
  g.fillStyle = "rgba(255,255,255,.5)"; g.fillRect(0, 2, 1024, 1);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
mats.membrane.map = seamTexture();

const roofY = () => B.h + 0.5; // top of insulation + membrane
function box(w, h, d, mat, x, y, z, shadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true;
  return m;
}

function buildBuilding() {
  bld.clear();
  const { w, d, h, parapet } = B, t = 1;
  mats.wall.color.set(WALLS[B.wall].hex);
  const mem = MEMBRANES[B.membrane];
  mats.membrane.color.set(mem.hex); mats.membrane.roughness = mem.rough;
  mats.membrane.map.repeat.set(1, d / 10);
  mats.coping.color.set(COPING[B.coping]);
  // walls (with the parapet) and the roof deck
  const top = h + parapet;
  bld.add(box(w, top, t, mats.wall, 0, top / 2, d / 2 - t / 2));
  bld.add(box(w, top, t, mats.wall, 0, top / 2, -d / 2 + t / 2));
  bld.add(box(t, top, d - 2 * t, mats.wall, w / 2 - t / 2, top / 2, 0));
  bld.add(box(t, top, d - 2 * t, mats.wall, -w / 2 + t / 2, top / 2, 0));
  bld.add(box(w - 2 * t, h, d - 2 * t, mats.wall, 0, h / 2, 0, false));
  const roof = box(w - 2 * t, 0.5, d - 2 * t, mats.membrane, 0, h + 0.25, 0, false);
  roof.name = "roof"; bld.add(roof);
  // membrane turned up the inside of the parapet, then metal coping on top
  for (const [cw, cd, cx, cz] of [[w - 2 * t, 0.05, 0, d / 2 - t - 0.03], [w - 2 * t, 0.05, 0, -d / 2 + t + 0.03], [0.05, d - 2 * t, w / 2 - t - 0.03, 0], [0.05, d - 2 * t, -w / 2 + t + 0.03, 0]])
    bld.add(box(cw, parapet - 0.3, cd, mats.membrane, cx, h + 0.5 + (parapet - 0.3) / 2, cz, false));
  for (const [cw, cd, cx, cz] of [[w + 0.4, t + 0.4, 0, d / 2 - t / 2], [w + 0.4, t + 0.4, 0, -d / 2 + t / 2], [t + 0.4, d, w / 2 - t / 2, 0], [t + 0.4, d, -w / 2 + t / 2, 0]])
    bld.add(box(cw, 0.35, cd, mats.coping, cx, top + 0.17, cz));
  // storefront: glass bays, mullions, a canopy and two entries on the street side
  const bays = Math.floor((w - 20) / 12);
  for (let i = 0; i < bays; i++) {
    const x = -((bays - 1) * 12) / 2 + i * 12;
    bld.add(box(10.6, 10, 0.3, mats.glass, x, 6.5, d / 2 + 0.05, false));
    bld.add(box(0.5, 10.4, 0.5, mats.mullion, x - 5.6, 6.5, d / 2 + 0.2));
    bld.add(box(10.6, 0.5, 0.5, mats.mullion, x, 11.5, d / 2 + 0.2));
    bld.add(box(10.6, 0.5, 0.5, mats.mullion, x, 1.5, d / 2 + 0.2));
  }
  bld.add(box(w * 0.7, 0.8, 6, mats.coping, 0, 13, d / 2 + 3));
  // scuppers + downspouts on the back wall
  for (const sx of [-w / 3, w / 3]) {
    bld.add(box(1.4, 0.8, 1.6, mats.galv, sx, h + 0.9, -d / 2 - 0.6));
    bld.add(box(0.7, h, 0.7, mats.galv, sx, h / 2, -d / 2 - 0.9));
  }
}

/* ---------- rooftop equipment models (base at y = 0, centered) ---------- */
function curb(w, d, g) { g.add(box(w + 0.6, 1.2, d + 0.6, mats.galv, 0, 0.6, 0)); return 1.2; }
function fanDisc(r, x, y, z, g) {
  const f = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.25, 28), mats.dark);
  f.position.set(x, y, z); f.castShadow = true; g.add(f);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.08, 6, 28), mats.louver);
  ring.rotation.x = Math.PI / 2; ring.position.set(x, y + 0.14, z); g.add(ring);
}
const MAKE = {
  rtu(g, [w, d], h) {
    const c = curb(w - 0.8, d - 0.8, g);
    g.add(box(w, h, d, mats.unit, 0, c + h / 2, 0));
    g.add(box(w * 0.42, h * 0.8, 0.12, mats.louver, -w * 0.25, c + h * 0.45, d / 2 + 0.05));   // condenser coil
    g.add(box(0.12, h * 0.8, d * 0.8, mats.louver, w / 2 + 0.05, c + h * 0.45, 0));
    g.add(box(w * 0.3, h * 0.45, 0.1, mats.dark, w * 0.27, c + h * 0.5, d / 2 + 0.05));          // access panel
    const fans = w > 9 ? 2 : 1;
    for (let i = 0; i < fans; i++) fanDisc(Math.min(d * 0.32, 1.7), -w * 0.3 + i * w * 0.24, c + h + 0.12, 0, g);
  },
  rtu10(g, s) { MAKE.rtu(g, s, 5); }, rtu5(g, s) { MAKE.rtu(g, s, 4.2); },
  exhaust(g) {
    const c = curb(2.4, 2.4, g);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 1.2, 24), mats.galv); base.position.y = c + 0.6; base.castShadow = true; g.add(base);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(1.7, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), mats.galv);
    cap.scale.y = 0.55; cap.position.y = c + 1.3; cap.castShadow = true; g.add(cap);
  },
  skylight(g, [w, d]) {
    const c = curb(w - 0.6, d - 0.6, g);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), mats.dome);
    dome.scale.set(w / 2 - 0.2, 0.9, d / 2 - 0.2); dome.position.y = c; g.add(dome);
  },
  hatch(g, [w, d]) {
    const c = curb(w - 0.4, d - 0.4, g);
    g.add(box(w + 0.2, 0.3, d + 0.2, mats.louver, 0, c + 0.15, 0));
    g.add(box(0.15, 0.6, 1.2, mats.dark, w / 2 - 0.3, c + 0.4, 0));
  },
  condenser(g, [w, d]) {
    g.add(box(0.5, 0.5, d + 1, mats.pad, -w / 2 + 0.6, 0.25, 0));
    g.add(box(0.5, 0.5, d + 1, mats.pad, w / 2 - 0.6, 0.25, 0));
    g.add(box(w, 2.6, d, mats.unit, 0, 1.8, 0));
    for (const [x, z, rx] of [[0, d / 2 + 0.04, 0], [w / 2 + 0.04, 0, 1]]) g.add(box(rx ? 0.08 : w * 0.85, 2.2, rx ? d * 0.85 : 0.08, mats.louver, x, 1.8, z));
    fanDisc(1.4, 0, 3.15, 0, g);
  },
  solar(g, [w, d]) {
    const cols = 6, rows = 2, pw = w / cols - 0.25, pd = d / rows - 0.7;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = -w / 2 + (c + 0.5) * (w / cols), z = -d / 2 + (r + 0.5) * (d / rows);
      const p = box(pw, 0.12, pd, mats.panel, x, 1.3, z); p.rotation.x = -0.2; g.add(p);
      g.add(box(pw * 0.9, 0.3, 0.3, mats.galv, x, 0.15, z - pd / 2 + 0.3));
      g.add(box(pw * 0.9, 0.3, 0.3, mats.galv, x, 0.15, z + pd / 2 - 0.3));
      g.add(box(0.15, 1.6, 0.15, mats.galv, x, 0.9, z - pd / 2 + 0.3));
    }
  },
  dish(g) {
    g.add(box(3, 0.3, 3, mats.pad, 0, 0.15, 0));
    g.add(box(0.25, 3, 0.25, mats.galv, 0, 1.6, 0));
    const dish = new THREE.Mesh(new THREE.SphereGeometry(1.4, 24, 10, 0, Math.PI * 2, 0, 0.9), new THREE.MeshStandardMaterial({ color: "#e4e4e0", side: THREE.DoubleSide, roughness: 0.5 }));
    dish.rotation.x = -Math.PI / 2 - 0.6; dish.position.set(0, 3.2, 0.3); dish.castShadow = true; g.add(dish);
  },
  pipe(g) {
    const boot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.55, 0.5, 18), mats.boot); boot.position.y = 0.25; g.add(boot);
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.6, 14), new THREE.MeshStandardMaterial({ color: "#d8d8d4", roughness: 0.6 }));
    p.position.y = 0.8; p.castShadow = true; g.add(p);
  },
  walkway(g, [w, d]) {
    const n = Math.round(d / 3);
    for (let i = 0; i < n; i++) g.add(box(w - 0.2, 0.12, 2.8, mats.pad, 0, 0.06, -d / 2 + 1.5 + i * 3, false));
  },
  drain(g) {
    const sump = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.05, 28), mats.dark); sump.position.y = 0.02; g.add(sump);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.55, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), mats.galv); dome.scale.y = 0.7; g.add(dome);
  },
};

/* ---------- items on the roof ---------- */
let items = [], selected = null, placing = null, ghost = null, nextId = 1;
const helpers = new THREE.Group();
scene.add(helpers);
const dims = (it) => { const [w, d] = ITEMS[it.type].size; return it.rot % 2 ? [d, w] : [w, d]; };

function makeObj(type) {
  const g = new THREE.Group();
  MAKE[type](g, ITEMS[type].size);
  g.traverse((o) => { if (o.isMesh) o.userData.type = type; });
  return g;
}
function add(type, x, z, rot = 0) {
  const it = { id: nextId++, type, x, z, rot, obj: makeObj(type) };
  it.obj.userData.item = it;
  it.obj.traverse((o) => { o.userData.item = it; });
  scene.add(it.obj);
  items.push(it);
  place(it, x, z);
  return it;
}
// keep everything inside the parapet, snapped to 6-inch steps
function place(it, x, z) {
  const [w, d] = dims(it), inX = B.w / 2 - 1 - w / 2, inZ = B.d / 2 - 1 - d / 2;
  it.x = Math.round(THREE.MathUtils.clamp(x, -inX, inX) * 2) / 2;
  it.z = Math.round(THREE.MathUtils.clamp(z, -inZ, inZ) * 2) / 2;
  it.obj.position.set(it.x, roofY(), it.z);
  it.obj.rotation.y = (it.rot * Math.PI) / 2;
}
function remove(it) {
  scene.remove(it.obj);
  items = items.filter((x) => x !== it);
  if (selected === it) select(null);
}

function starter() {
  items.slice().forEach(remove);
  const w = B.w, d = B.d;
  add("drain", -w / 4, -d / 6); add("drain", w / 4, -d / 6); add("drain", -w / 4, d / 4); add("drain", w / 4, d / 4);
  add("hatch", -w / 2 + 12, -d / 2 + 10);
  add("rtu10", -w / 6, -4); add("rtu10", w / 6 + 8, -4); add("rtu5", 0, d / 4 - 2, 1);
  add("exhaust", w / 2 - 18, d / 6); add("exhaust", w / 2 - 24, d / 6); add("exhaust", -w / 2 + 22, d / 6);
  add("skylight", -10, -d / 2 + 16, 1); add("skylight", 14, -d / 2 + 16, 1);
  add("pipe", -w / 2 + 30, 6); add("pipe", 6, 14);
  add("walkway", -w / 2 + 20, -d / 2 + 22, 1);
  select(null);
  checks();
}

/* ---------- roof checks: what it takes to make this layout work ---------- */
function rect(it) { const [w, d] = dims(it); return { x0: it.x - w / 2, x1: it.x + w / 2, z0: it.z - d / 2, z1: it.z + d / 2 }; }
function gap(a, b) {
  const dx = Math.max(0, Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1)), dz = Math.max(0, Math.max(a.z0, b.z0) - Math.min(a.z1, b.z1));
  return Math.hypot(dx, dz);
}
function checks() {
  const issues = new Map(); // item → [messages]
  const flag = (it, m) => { if (!issues.has(it)) issues.set(it, []); issues.get(it).push(m); };
  const lowParapet = B.parapet < 3.25; // OSHA counts a parapet of 39 in or more as a guardrail
  const edge = (it) => { const r = rect(it); return Math.min(r.x0 + B.w / 2 - 1, B.w / 2 - 1 - r.x1, r.z0 + B.d / 2 - 1, B.d / 2 - 1 - r.z1); };
  for (const it of items) {
    const spec = ITEMS[it.type];
    if (lowParapet && !spec.flat && !spec.pen) {
      const e = edge(it);
      if (e < 6) flag(it, "Under 6 ft from the roof edge: service needs a guardrail or personal fall arrest.");
      else if (e < 15) flag(it, "Within 15 ft of the roof edge: mark a safe work zone or add guardrail for service.");
    }
    for (const o of items) {
      if (o === it) continue;
      const g = gap(rect(it), rect(o)), os = ITEMS[o.type];
      if (spec.drain && !os.drain && !os.flat && g < 2) flag(o, "Sits on or crowds a roof drain. Water will pond around it.");
      if (!spec.drain && !os.drain && !spec.flat && !os.flat && g === 0 && it.id < o.id) flag(it, `Overlaps the ${os.name.toLowerCase()}.`);
      else if (spec.curb && os.curb && g > 0 && g < 2 && it.id < o.id) flag(it, `Curbs closer than 24 in to the ${os.name.toLowerCase()} can't be flashed properly.`);
    }
    if (it.type === "solar" && B.membrane === "epdm") flag(it, "Black EPDM runs hot under panels. Add protection pads and confirm the warranty allows ballasted solar.");
  }
  if (B.membrane === "epdm" || B.membrane === "modbit") {
    // nothing to flag per item; the summary notes the energy trade-off
  }
  // highlight
  helpers.clear();
  for (const it of items) {
    const bad = issues.has(it), sel = it === selected;
    if (!bad && !sel) continue;
    const h = new THREE.BoxHelper(it.obj, sel ? 0x2f6bff : 0xff5a3c);
    helpers.add(h);
  }
  // summary list
  const count = {}; items.forEach((it) => { count[it.type] = (count[it.type] || 0) + 1; });
  const curbs = items.filter((it) => ITEMS[it.type].curb).length, pens = items.filter((it) => ITEMS[it.type].pen).length;
  const drains = count.drain || 0, area = (B.w - 2) * (B.d - 2);
  const list = [];
  issues.forEach((msgs, it) => msgs.forEach((m) => list.push(`<li class="bad"><b>${ITEMS[it.type].name}:</b> ${m}</li>`)));
  if (drains * 10000 < area) list.push(`<li class="bad"><b>Drainage:</b> ${drains} drain${drains === 1 ? "" : "s"} for ${Math.round(area).toLocaleString()} sq ft. Plan on about one per 10,000 sq ft plus overflow scuppers.</li>`);
  if (!count.walkway && (count.rtu10 || count.rtu5)) list.push(`<li class="warn"><b>Walkway pads:</b> add a path from the hatch to the units so service traffic doesn't wear the membrane.</li>`);
  if (!list.length) list.push(`<li class="ok">No conflicts. Every curb can be flashed and the drains are clear.</li>`);
  $("#cmChecks").innerHTML = list.join("");
  $("#cmCounts").innerHTML = `
    <div><dt>Roof area</dt><dd>${Math.round(area).toLocaleString()} sq ft</dd></div>
    <div><dt>Curbs to flash</dt><dd>${curbs}</dd></div>
    <div><dt>Penetrations</dt><dd>${pens + drains}</dd></div>
    <div><dt>Equipment</dt><dd>${items.filter((it) => !ITEMS[it.type].flat && !ITEMS[it.type].pen).length}</dd></div>`;
  request();
}

/* ---------- select / place / drag ---------- */
function select(it) {
  selected = it;
  const box = $("#cmSel");
  box.hidden = !it;
  if (it) {
    $("#cmSelName").textContent = ITEMS[it.type].name;
    $("#cmSelNote").textContent = ITEMS[it.type].note;
  }
  checks();
}
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(V(0, 1, 0), 0), hit = new THREE.Vector3();
function pointer(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
}
function roofPoint(e) {
  pointer(e);
  plane.constant = -roofY();
  return ray.ray.intersectPlane(plane, hit) ? hit.clone() : null;
}
let drag = null;
canvas.addEventListener("pointerdown", (e) => {
  if (placing) {
    const p = roofPoint(e);
    if (p) { const it = add(placing, p.x, p.z, ghost?.rot || 0); stopPlacing(); select(it); }
    return;
  }
  pointer(e);
  const hits = ray.intersectObjects(items.map((it) => it.obj), true);
  const it = hits[0]?.object.userData.item;
  if (it) {
    select(it);
    const p = roofPoint(e);
    drag = { it, dx: p ? it.x - p.x : 0, dz: p ? it.z - p.z : 0 };
    controls.enabled = false;
    canvas.setPointerCapture(e.pointerId);
  } else if (selected) {
    select(null);
  }
});
canvas.addEventListener("pointermove", (e) => {
  if (placing && ghost) {
    const p = roofPoint(e);
    if (p) { place(ghost, p.x, p.z); ghost.obj.visible = true; request(); }
  } else if (drag) {
    const p = roofPoint(e);
    if (p) { place(drag.it, p.x + drag.dx, p.z + drag.dz); checks(); }
  }
});
canvas.addEventListener("pointerup", () => { drag = null; controls.enabled = true; });

function startPlacing(type) {
  stopPlacing();
  select(null);
  placing = type;
  ghost = { type, rot: 0, x: 0, z: 0, obj: makeObj(type) };
  ghost.obj.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.55; o.castShadow = false; } });
  ghost.obj.visible = false;
  scene.add(ghost.obj);
  canvas.classList.add("is-placing");
  $("#cmHint").textContent = `Click the roof to place the ${ITEMS[type].name.toLowerCase()} · R rotates · Esc cancels`;
  document.querySelectorAll("[data-item]").forEach((b) => b.classList.toggle("is-on", b.dataset.item === type));
}
function stopPlacing() {
  if (ghost) scene.remove(ghost.obj);
  placing = ghost = null;
  canvas.classList.remove("is-placing");
  $("#cmHint").textContent = "Drag to orbit · scroll to zoom · click equipment to select and drag it";
  document.querySelectorAll("[data-item]").forEach((b) => b.classList.remove("is-on"));
  request();
}
function rotate(it) { it.rot = (it.rot + 1) % 4; place(it, it.x, it.z); checks(); }

/* ---------- UI ---------- */
const chips = (el, opts, key) => {
  el.innerHTML = Object.entries(opts).map(([k, v]) => `<button type="button" class="chip${B[key] === k ? " is-on" : ""}" data-k="${k}">${v.name || v}</button>`).join("");
  el.addEventListener("click", (e) => {
    const b = e.target.closest("[data-k]");
    if (!b) return;
    B[key] = b.dataset.k;
    el.querySelectorAll("[data-k]").forEach((x) => x.classList.toggle("is-on", x === b));
    rebuild();
  });
};
chips($("#cmMembrane"), MEMBRANES, "membrane");
chips($("#cmWall"), WALLS, "wall");
chips($("#cmCoping"), { white: "White", bronze: "Bronze", black: "Black" }, "coping");
$("#cmParapet").addEventListener("change", (e) => { B.parapet = +e.target.value; rebuild(); });
for (const k of ["w", "d"]) {
  const el = $(`#cm${k.toUpperCase()}`);
  el.value = B[k];
  el.addEventListener("change", () => { B[k] = THREE.MathUtils.clamp(+el.value || B[k], 40, 300); el.value = B[k]; rebuild(true); });
}
$("#cmItems").innerHTML = Object.entries(ITEMS).map(([k, v]) => `<button type="button" class="cm-item" data-item="${k}"><b>${v.name}</b><small>${v.size[0]} × ${v.size[1]} ft</small></button>`).join("");
$("#cmItems").addEventListener("click", (e) => { const b = e.target.closest("[data-item]"); if (b) startPlacing(b.dataset.item); });
$("#cmRotate").addEventListener("click", () => selected && rotate(selected));
$("#cmDelete").addEventListener("click", () => { if (selected) { remove(selected); checks(); } });
$("#cmClear").addEventListener("click", () => { items.slice().forEach(remove); checks(); });
$("#cmReset").addEventListener("click", starter);
addEventListener("keydown", (e) => {
  if (/input|select|textarea/i.test(e.target.tagName)) return;
  if (e.key === "Escape") { stopPlacing(); select(null); }
  if (e.key === "r" || e.key === "R") { if (ghost) { ghost.rot = (ghost.rot + 1) % 4; place(ghost, ghost.x, ghost.z); request(); } else if (selected) rotate(selected); }
  if ((e.key === "Delete" || e.key === "Backspace") && selected) { e.preventDefault(); remove(selected); checks(); }
});
$("#cmMemNote").textContent = MEMBRANES[B.membrane].note;

function rebuild(resize) {
  buildBuilding();
  $("#cmMemNote").textContent = MEMBRANES[B.membrane].note;
  if (resize) starter(); else items.forEach((it) => place(it, it.x, it.z));
  checks();
  if (resize) view("aerial");
}

/* ---------- views + render ---------- */
const VIEWS = {
  aerial: () => [V(-B.w * 1.05, B.h + B.w * 0.85, B.d * 1.9), V(0, B.h, 0)],
  street: () => [V(-B.w * 0.55, 8, B.d / 2 + B.w * 1.1), V(0, B.h * 0.65, 0)],
  top: () => [V(0, B.h + Math.max(B.w, B.d) * 1.9, 0.01), V(0, B.h, 0)],
};
function view(k) {
  const [p, t] = VIEWS[k]();
  camera.position.copy(p); controls.target.copy(t); controls.update();
  document.querySelectorAll("[data-view]").forEach((b) => b.classList.toggle("is-on", b.dataset.view === k));
  request();
}
document.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => view(b.dataset.view)));

let queued = false;
function request() { if (!queued) { queued = true; requestAnimationFrame(frame); } }
function frame() {
  queued = false;
  if (controls.update()) request(); // damping still settling
  helpers.children.forEach((h) => h.update());
  stage.render();
}
new ResizeObserver(() => { stage.resize(); request(); }).observe(canvas);
TX.onTextureLoad((left) => { if (left === 0) $("#cmLoading").classList.add("is-gone"); request(); });

/* ---------- send the layout ---------- */
$("#cmSend").addEventListener("click", async () => {
  const count = {}; items.forEach((it) => { count[it.type] = (count[it.type] || 0) + 1; });
  const summary = [`Commercial roof: ${B.w} × ${B.d} ft, ${MEMBRANES[B.membrane].name}, ${Math.round(B.parapet * 12)} in parapet, ${WALLS[B.wall].name}`,
    ...Object.entries(count).map(([k, n]) => `${ITEMS[k].name} × ${n}`),
    "Checks: " + [...document.querySelectorAll("#cmChecks li")].map((li) => li.textContent).join(" / ")].join(" | ");
  window.CD?.attach("build", summary);
  select(null); stopPlacing();
  const blob = await stage.snapshot(1600);
  if (blob) window.CD?.attach("render", blob);
  const list = window.CD?.attachments.interests || [];
  if (!list.includes("Commercial")) window.CD?.attach("interests", [...list, "Commercial"]);
  window.CD?.goTo("contact");
});

buildBuilding();
starter();
view("aerial");
stage.resize();
request();
