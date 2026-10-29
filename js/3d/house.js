/* The house. Units are feet; +z faces the street, +y is up.
   Built in layers so the scroll animation can tear it down and rebuild it:
   roof  = deck (OSB) → underlayment → old shingles (tiled) | new shingles (3D strips) | metal
   walls = sheathing → house wrap → old siding | new siding                                */
import * as THREE from "three";
import * as TX from "./textures.js";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

/* ---------------------------------------------------------------- layout */
const MAIN = { x0: -18, x1: 18, z0: -14, z1: 14, sill: 1.2, eave: 18 };
const PITCH = 8 / 12;
const RIDGE_Y = MAIN.eave + 14 * PITCH; // 27.33
const BAY = { x0: -16, x1: -4, z: 18, pitch: 10 / 12 };
const BAY_RIDGE = MAIN.eave + 6 * BAY.pitch; // 23
const GAR = { x0: 18, x1: 40, z0: -12, z1: 10, sill: 0.5, eave: 9.5, pitch: 5 / 12 };
const GAR_RIDGE = GAR.eave + 11 * GAR.pitch;
const PORCH = { x0: -4, x1: 14.5, z0: 14, z1: 21.5, floor: 1.5, top: 11.2, pitch: 3 / 12 };

const mainRoofY = (z) => RIDGE_Y - Math.abs(z) * PITCH;

/* window openings in world terms, per wall: [left, bottom, width, height, cols] in wall-local feet */
const OPEN = {
  mainFront: { win: [[19.6, 10.8, 3.4, 4.6, 1], [27, 10.8, 3.4, 4.6, 1], [27, 2.4, 3.4, 5, 1]], door: [[19.3, 0.3, 5.4, 6.9]] },
  bayFront: { win: [[1.5, 2.2, 9, 5.2, 3], [3.5, 10.2, 5, 4.8, 2]] },
  left: { win: [[4.5, 2.4, 3, 4.6, 1], [20.5, 2.4, 3, 4.6, 1], [4.5, 10.8, 3, 4.6, 1], [20.5, 10.8, 3, 4.6, 1]] },
  right: { win: [[5.5, 10.8, 3, 4.6, 1]] },
  back: { win: [[4, 2.4, 4, 4.6, 1], [14, 2.4, 3, 4.6, 1], [24, 10.8, 3, 4.6, 1], [8, 10.8, 3, 4.6, 1]] },
  garFront: { garage: [[3, 0, 16, 8]] },
  garRight: { win: [[9.5, 3.4, 3, 3.6, 1]] },
};

/* walls: origin = outside bottom-left as seen from outside, u = along wall, n = outward */
function walls() {
  const H = MAIN.eave - MAIN.sill, GH = GAR.eave - GAR.sill;
  return [
    { id: "mainFront", o: V(MAIN.x0, MAIN.sill, MAIN.z1), u: V(1, 0, 0), n: V(0, 0, 1), w: 36, h: H, ...OPEN.mainFront },
    { id: "back", o: V(MAIN.x1, MAIN.sill, MAIN.z0), u: V(-1, 0, 0), n: V(0, 0, -1), w: 36, h: H, ...OPEN.back },
    { id: "left", o: V(MAIN.x0, MAIN.sill, MAIN.z0), u: V(0, 0, 1), n: V(-1, 0, 0), w: 28, h: H, rise: 14 * PITCH, ...OPEN.left },
    { id: "right", o: V(MAIN.x1, MAIN.sill, MAIN.z1), u: V(0, 0, -1), n: V(1, 0, 0), w: 28, h: H, rise: 14 * PITCH, ...OPEN.right },
    { id: "bayFront", o: V(BAY.x0, MAIN.sill, BAY.z), u: V(1, 0, 0), n: V(0, 0, 1), w: 12, h: H, rise: 6 * BAY.pitch, ...OPEN.bayFront },
    { id: "bayL", o: V(BAY.x0, MAIN.sill, MAIN.z1), u: V(0, 0, 1), n: V(-1, 0, 0), w: 4, h: H },
    { id: "bayR", o: V(BAY.x1, MAIN.sill, BAY.z), u: V(0, 0, -1), n: V(1, 0, 0), w: 4, h: H },
    { id: "garFront", o: V(GAR.x0, GAR.sill, GAR.z1), u: V(1, 0, 0), n: V(0, 0, 1), w: 22, h: GH, ...OPEN.garFront },
    { id: "garRight", o: V(GAR.x1, GAR.sill, GAR.z1), u: V(0, 0, -1), n: V(1, 0, 0), w: 22, h: GH, rise: 11 * GAR.pitch, ...OPEN.garRight },
    { id: "garBack", o: V(GAR.x1, GAR.sill, GAR.z0), u: V(-1, 0, 0), n: V(0, 0, -1), w: 22, h: GH },
  ];
}

/* roof planes: p0 = eave start, ed = along eave, ud = up-slope, L = eave length, S = slope length */
function roofPlanes() {
  const P = [];
  const add = (id, p0, ed, top, L, opts = {}) => {
    const ud = top.clone().sub(p0).normalize();
    const S = top.clone().sub(p0).length();
    const n = new THREE.Vector3().crossVectors(ed, ud).normalize();
    P.push({ id, p0, ed, ud, n, L, S, ...opts });
  };
  const eY = MAIN.eave - 1.5 * PITCH;
  add("mainFront", V(-19, eY, 15.5), V(1, 0, 0), V(-19, RIDGE_Y, 0), 38);
  add("mainBack", V(19, eY, -15.5), V(-1, 0, 0), V(19, RIDGE_Y, 0), 38);
  const bY = MAIN.eave - BAY.pitch;
  const hidden = (p) => p.y < mainRoofY(p.z) - 0.08;
  add("bayL", V(-17, bY, 5.5), V(0, 0, 1), V(-10, BAY_RIDGE, 5.5), 13.5, { hidden });
  add("bayR", V(-3, bY, 19), V(0, 0, -1), V(-10, BAY_RIDGE, 19), 13.5, { hidden });
  const gY = GAR.eave - 1.2 * GAR.pitch;
  add("garFront", V(18, gY, GAR.z1 + 1.2), V(1, 0, 0), V(18, GAR_RIDGE, -1), 23);
  add("garBack", V(41, gY, GAR.z0 - 1.2), V(-1, 0, 0), V(41, GAR_RIDGE, -1), 23);
  const pY = PORCH.top - (PORCH.z1 - PORCH.z0) * PORCH.pitch;
  add("porch", V(PORCH.x0, pY, PORCH.z1), V(1, 0, 0), V(PORCH.x0, PORCH.top, PORCH.z0), PORCH.x1 - PORCH.x0);
  return P;
}

/* ---------------------------------------------------------------- geometry helpers */
function basis(u, n) { return new THREE.Matrix4().makeBasis(u, new THREE.Vector3().crossVectors(n, u), n); }

function wallGeometry(w, h, rise, holes) {
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.lineTo(w, 0); s.lineTo(w, h);
  if (rise) s.lineTo(w / 2, h + rise);
  s.lineTo(0, h); s.lineTo(0, 0);
  for (const [x, y, hw, hh] of holes) {
    const p = new THREE.Path();
    p.moveTo(x, y); p.lineTo(x, y + hh); p.lineTo(x + hw, y + hh); p.lineTo(x + hw, y); p.lineTo(x, y);
    s.holes.push(p);
  }
  return new THREE.ShapeGeometry(s);
}

function placeOnWall(mesh, wall, offset) {
  const m = basis(wall.u, wall.n);
  m.setPosition(wall.o.clone().addScaledVector(wall.n, offset));
  mesh.applyMatrix4(m);
  return mesh;
}

function roofQuad(pl, inset = 0) {
  const a = pl.p0, b = pl.p0.clone().addScaledVector(pl.ed, pl.L);
  const c = b.clone().addScaledVector(pl.ud, pl.S), d = a.clone().addScaledVector(pl.ud, pl.S);
  const off = pl.n.clone().multiplyScalar(inset);
  const pos = [a, b, c, d].map((p) => p.clone().add(off));
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos.flatMap((p) => [p.x, p.y, p.z]), 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, pl.L, 0, pl.L, pl.S, 0, pl.S], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  return g;
}

/* BoxGeometry UVs are 0..1 per face; rescale to feet so tiled textures keep real-world size */
function feetBox(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k;
    uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]);
  }
  return g;
}

function box(w, h, d, mat, x, y, z, parent) {
  const m = new THREE.Mesh(feetBox(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}

/* a box from point a to point b (thin trim boards along any direction) */
function beam(a, b, w, h, mat, parent, up = UP) {
  const len = a.distanceTo(b);
  const m = new THREE.Mesh(new THREE.BoxGeometry(len, h, w), mat);
  const dir = b.clone().sub(a).normalize();
  const side = new THREE.Vector3().crossVectors(dir, up).normalize();
  const realUp = new THREE.Vector3().crossVectors(side, dir).normalize();
  m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(dir, realUp, side));
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}

function texMat(t, sizeFt, opts = {}) {
  const map = t.map.clone(); map.needsUpdate = true; map.repeat.set(1 / sizeFt, 1 / sizeFt);
  const m = new THREE.MeshStandardMaterial({ map, roughness: 0.85, ...opts });
  if (t.bump) { const b = t.bump.clone(); b.needsUpdate = true; b.repeat.copy(map.repeat); m.bumpMap = b; m.bumpScale = opts.bumpScale ?? 2.2; }
  return m;
}

/* ---------------------------------------------------------------- build */
export function buildHouse({ mode = "viz" } = {}) {
  const root = new THREE.Group();
  const build = mode === "build";

  // ---- shared materials (product colors set later)
  const M = {
    trim: new THREE.MeshStandardMaterial({ color: "#f4f3ee", roughness: 0.55 }),
    frame: new THREE.MeshStandardMaterial({ color: "#f2f2ee", roughness: 0.45 }),
    door: new THREE.MeshStandardMaterial({ color: "#2552c9", roughness: 0.4 }),
    gutter: new THREE.MeshStandardMaterial({ color: "#f2f2ee", roughness: 0.35, metalness: 0.2 }),
    glass: new THREE.MeshStandardMaterial({ color: "#1b2433", roughness: 0.04, metalness: 0.9, envMapIntensity: 1.4 }),
    glow: new THREE.MeshBasicMaterial({ color: "#ffcf87", transparent: true, opacity: 0 }),
    concrete: new THREE.MeshStandardMaterial({ map: TX.photo("concrete"), color: "#b9b6ae", roughness: 0.92 }),
    hardware: new THREE.MeshStandardMaterial({ color: "#2a2a2a", metalness: 0.8, roughness: 0.35 }),
    lamp: new THREE.MeshStandardMaterial({ color: "#1a1a1a", emissive: "#ffcf87", emissiveIntensity: 0, roughness: 0.4 }),
  };
  M.stone = new THREE.MeshStandardMaterial({ map: TX.photo("stone", { repeat: 1 / 5 }), normalMap: TX.photo("stone-nor", { srgb: false, repeat: 1 / 5 }), color: "#d6d3cc", roughness: 0.95 });
  M.chimney = M.stone.clone();
  M.concrete.map = TX.photo("concrete", { repeat: 1 / 8 });
  const ceil = TX.boards("#b68a5c");
  M.ceiling = new THREE.MeshStandardMaterial({ map: ceil.map.clone(), roughness: 0.7 });
  M.ceiling.map.needsUpdate = true; M.ceiling.map.repeat.set(1 / 4, 1 / 4);
  const deckB = TX.boards("#7c7a76", 91);
  M.porchFloor = new THREE.MeshStandardMaterial({ map: deckB.map.clone(), roughness: 0.8 });
  M.porchFloor.map.needsUpdate = true; M.porchFloor.map.repeat.set(1 / 4, 1 / 4);

  const sidingMats = {};
  for (const p of ["lap", "batten", "shake"]) {
    const t = TX.siding(p);
    sidingMats[p] = texMat(t, t.size, { roughness: 0.78, bumpScale: 2.5 });
  }
  const oldSidingMat = texMat(TX.siding("lap"), 7, { color: "#d9cfb8", roughness: 0.6, bumpScale: 2 });
  const metalT = TX.metalSeam();
  const metalMat = texMat(metalT, metalT.size, { roughness: 0.5, metalness: 0.3, bumpScale: 3 });
  const stripT = TX.shingleStrip();
  const stripMat = new THREE.MeshStandardMaterial({ map: stripT.map, bumpMap: stripT.bump, bumpScale: 3, roughness: 0.92, color: "#3a3b3e" });
  const oldT = TX.shingleTile(3);
  const oldRoofMat = texMat(oldT, oldT.size, { color: "#7a6250", roughness: 0.95, bumpScale: 2 });
  const osbT = TX.osb();
  const osbMat = texMat(osbT, osbT.size, { roughness: 0.9 });
  const underT = TX.underlayment();
  const underMat = texMat(underT, underT.size, { roughness: 0.6 });
  const wrapT = TX.houseWrap();
  const wrapMat = texMat(wrapT, wrapT.size, { roughness: 0.55 });

  const clip = (m) => { const c = m.clone(); c.clippingPlanes = [new THREE.Plane()]; c.clipShadows = true; return c; };

  /* ---------- walls ---------- */
  const W = walls();
  const wallLayers = { sheath: [], wrap: [], old: [], new: [] };
  const sidingMeshes = [];
  const newSidingMats = {};
  for (const p of ["lap", "batten", "shake"]) newSidingMats[p] = build ? clip(sidingMats[p]) : sidingMats[p];
  const sheathMat = osbMat, wrapClip = clip(wrapMat), oldSideClip = clip(oldSidingMat);

  for (const w of W) {
    const holes = [...(w.win || []).map((r) => r.slice(0, 4)), ...(w.door || []), ...(w.garage || [])];
    const geo = wallGeometry(w.w, w.h, w.rise, holes);
    const mk = (mat, off) => {
      const m = placeOnWall(new THREE.Mesh(geo, mat), w, off);
      m.castShadow = m.receiveShadow = true;
      root.add(m);
      return m;
    };
    if (build) {
      wallLayers.sheath.push(mk(sheathMat, 0.0));
      wallLayers.wrap.push(mk(wrapClip, 0.03));
      wallLayers.old.push(mk(oldSideClip, 0.06));
    }
    const s = mk(newSidingMats.lap, 0.09);
    sidingMeshes.push(s);
    wallLayers.new.push(s);
  }

  /* foundations */
  box(36.2, MAIN.sill + 0.3, 28.2, M.concrete, 0, (MAIN.sill + 0.3) / 2 - 0.3, 0, root);
  box(12.2, MAIN.sill + 0.3, 4.2, M.concrete, -10, (MAIN.sill + 0.3) / 2 - 0.3, 16, root);
  box(22.2, GAR.sill + 0.3, 22.2, M.concrete, 29, (GAR.sill + 0.3) / 2 - 0.3, -1, root);
  // interior blocks so nothing is see-through
  box(35.6, 16.6, 27.6, new THREE.MeshStandardMaterial({ color: "#2b2b2b" }), 0, 9.6, 0, root).castShadow = false;
  box(21.6, 9, 21.6, new THREE.MeshStandardMaterial({ color: "#2b2b2b" }), 29, 5, -1, root).castShadow = false;
  box(11.6, 16.6, 3.6, new THREE.MeshStandardMaterial({ color: "#2b2b2b" }), -10, 9.6, 16, root).castShadow = false;

  /* ---------- trim: corners, band, fascia, rakes, soffits ---------- */
  const trimG = new THREE.Group(); root.add(trimG);
  const corner = (x, z, y0, y1, nx, nz) => box(0.42, y1 - y0, 0.42, M.trim, x + nx * 0.12, (y0 + y1) / 2, z + nz * 0.12, trimG);
  corner(MAIN.x0, MAIN.z0, MAIN.sill, MAIN.eave, -1, -1); corner(MAIN.x1, MAIN.z0, MAIN.sill, MAIN.eave, 1, -1);
  corner(MAIN.x1, MAIN.z1, MAIN.sill, MAIN.eave, 1, 1); corner(MAIN.x0, MAIN.z1, MAIN.sill, MAIN.eave, -1, 1);
  corner(BAY.x0, BAY.z, MAIN.sill, MAIN.eave, -1, 1); corner(BAY.x1, BAY.z, MAIN.sill, MAIN.eave, 1, 1);
  corner(GAR.x1, GAR.z1, GAR.sill, GAR.eave, 1, 1); corner(GAR.x1, GAR.z0, GAR.sill, GAR.eave, 1, -1);
  // floor band
  box(36.4, 0.55, 0.2, M.trim, 0, 10.2, MAIN.z1 + 0.14, trimG);
  box(12.4, 0.55, 0.2, M.trim, -10, 10.2, BAY.z + 0.14, trimG);
  box(0.2, 0.55, 28.4, M.trim, MAIN.x0 - 0.14, 10.2, 0, trimG);
  // fascia + soffit along eaves
  const eY = MAIN.eave - 1.5 * PITCH;
  const fascia = (x0, x1, z, y, alongZ = false) => {
    if (!alongZ) box(x1 - x0, 0.8, 0.14, M.trim, (x0 + x1) / 2, y - 0.38, z, trimG);
    else box(0.14, 0.8, x1 - x0, M.trim, z, y - 0.38, (x0 + x1) / 2, trimG);
  };
  fascia(-19, -17, 15.55, eY); fascia(-3, 19, 15.55, eY); fascia(-19, 19, -15.55, eY);
  box(38, 0.12, 1.5, M.trim, 0, eY - 0.75, 14.8, trimG); box(38, 0.12, 1.5, M.trim, 0, eY - 0.75, -14.8, trimG);
  const bY = MAIN.eave - BAY.pitch;
  fascia(15.3, 19, -17.05, bY, true); fascia(15.3, 19, -2.95, bY, true);
  const gY = GAR.eave - 1.2 * GAR.pitch;
  fascia(18, 41, GAR.z1 + 1.25, gY); fascia(18, 41, GAR.z0 - 1.25, gY);
  box(23, 0.12, 1.2, M.trim, 29.5, gY - 0.75, GAR.z1 + 0.6, trimG);
  // rakes (gable edges)
  const rake = (a, b) => beam(a, b, 0.16, 0.8, M.trim, trimG);
  rake(V(-19.05, eY - 0.3, 15.5), V(-19.05, RIDGE_Y - 0.3, 0)); rake(V(-19.05, RIDGE_Y - 0.3, 0), V(-19.05, eY - 0.3, -15.5));
  rake(V(19.05, eY - 0.3, 15.5), V(19.05, RIDGE_Y - 0.3, 0)); rake(V(19.05, RIDGE_Y - 0.3, 0), V(19.05, eY - 0.3, -15.5));
  rake(V(-17, bY - 0.3, 19.05), V(-10, BAY_RIDGE - 0.3, 19.05)); rake(V(-10, BAY_RIDGE - 0.3, 19.05), V(-3, bY - 0.3, 19.05));
  rake(V(41.05, gY - 0.3, GAR.z1 + 1.2), V(41.05, GAR_RIDGE - 0.3, -1)); rake(V(41.05, GAR_RIDGE - 0.3, -1), V(41.05, gY - 0.3, GAR.z0 - 1.2));
  // gable soffit (underside of bay overhang)
  box(14, 0.1, 1, M.trim, -10, bY - 0.7, 18.6, trimG);

  /* ---------- gutters ---------- */
  const gutG = new THREE.Group(); root.add(gutG);
  const gutter = (x0, x1, z, y, alongZ = false) => {
    const g = new THREE.Mesh(new THREE.BoxGeometry(alongZ ? 0.45 : x1 - x0, 0.45, alongZ ? x1 - x0 : 0.45), M.gutter);
    g.position.set(alongZ ? z : (x0 + x1) / 2, y - 0.45, alongZ ? (x0 + x1) / 2 : z);
    g.castShadow = true; gutG.add(g);
  };
  gutter(-19, -17, 15.85, eY); gutter(-3, 19, 15.85, eY); gutter(-19, 19, -15.85, eY);
  gutter(15.3, 19, -17.35, bY, true); gutter(15.3, 19, -2.65, bY, true);
  gutter(18, 41, GAR.z1 + 1.55, gY); gutter(18, 41, GAR.z0 - 1.55, gY);
  const pY = PORCH.top - (PORCH.z1 - PORCH.z0) * PORCH.pitch;
  gutter(PORCH.x0, PORCH.x1, PORCH.z1 + 0.3, pY);
  const spout = (x, z, y) => box(0.32, y, 0.32, M.gutter, x, y / 2, z, gutG);
  spout(18.6, 15.2, eY - 0.5); spout(40.8, 11.6, gY - 0.5); spout(-17.3, 19.2, bY - 0.5); spout(-18.6, -15.4, eY - 0.5);

  /* ---------- roofs ---------- */
  const planes = roofPlanes();
  const roofLayers = { deck: [], under: [], old: [], metal: [] };
  for (const pl of planes) {
    const g0 = roofQuad(pl, 0.0);
    const mk = (mat, inset) => {
      const m = new THREE.Mesh(inset ? roofQuad(pl, inset) : g0, mat);
      m.castShadow = m.receiveShadow = true;
      root.add(m);
      return m;
    };
    if (build) {
      roofLayers.deck.push(mk(osbMat, 0));
      roofLayers.under.push(mk(clip(underMat), 0.02));
      roofLayers.old.push(mk(clip(oldRoofMat), 0.05));
    } else {
      roofLayers.deck.push(mk(new THREE.MeshStandardMaterial({ color: "#2a2b2d", roughness: 0.9 }), 0));
    }
    roofLayers.metal.push(mk(metalMat, 0.06));
  }

  // 3D shingle strips — every course, racked, like a real install
  const strips = [];
  const EXPO = 5 / 12;
  for (const [pi, pl] of planes.entries()) {
    const courses = Math.floor((pl.S - 0.3) / EXPO);
    for (let c = 0; c < courses; c++) {
      const s = c * EXPO;
      const off = (c * 0.5) % 3;
      for (let x = -off; x < pl.L; x += 3) {
        const x0 = Math.max(0, x), x1 = Math.min(pl.L, x + 3), wdt = x1 - x0;
        if (wdt < 0.25) continue;
        const h = Math.min(1, pl.S - s);
        const center = pl.p0.clone().addScaledVector(pl.ed, x0 + wdt / 2).addScaledVector(pl.ud, s + h / 2).addScaledVector(pl.n, 0.1);
        if (pl.hidden && pl.hidden(center)) continue;
        strips.push({ pi, c, courses, x: x0 / pl.L, center, wdt, h, flip: Math.random() < 0.5 });
      }
    }
  }
  const stripGeo = new THREE.BoxGeometry(3, 1, 0.035);
  const stripMesh = new THREE.InstancedMesh(stripGeo, stripMat, strips.length);
  stripMesh.castShadow = stripMesh.receiveShadow = true;
  const tilt = new THREE.Quaternion();
  const col = new THREE.Color();
  const finals = [];
  strips.forEach((st, i) => {
    const pl = planes[st.pi];
    const q = new THREE.Quaternion().setFromRotationMatrix(basis(pl.ed, pl.n));
    tilt.setFromAxisAngle(V(1, 0, 0), -0.09); // butt edge lifts ~1/2", enough separation between courses for the depth buffer
    q.multiply(tilt);
    const m = new THREE.Matrix4().compose(st.center, q, V(st.wdt / 3, st.h, 1)); // never mirror with a negative scale: it turns the strip inside out (renders black)
    finals.push(m);
    stripMesh.setMatrixAt(i, m);
    const v = 0.9 + Math.random() * 0.2;
    stripMesh.setColorAt(i, col.setRGB(v, v, v));
  });
  stripMesh.layers.set(1); // overlapping strips read as crevices to ambient occlusion; keep them out of that pass
  root.add(stripMesh);

  // ridge caps (main ridge sits up on a ridge vent)
  const capG = new THREE.Group(); root.add(capG);
  const capMain = new THREE.Group(); root.add(capMain);
  const capMat = stripMat.clone();
  const cap = (a, b, g = capG) => beam(a, b, 1.05, 0.22, capMat, g);
  cap(V(-19.1, RIDGE_Y + 0.34, 0), V(19.1, RIDGE_Y + 0.34, 0), capMain);
  cap(V(-10, BAY_RIDGE + 0.1, 19.1), V(-10, BAY_RIDGE + 0.1, 7.3));
  cap(V(18, GAR_RIDGE + 0.1, -1), V(41.1, GAR_RIDGE + 0.1, -1));

  /* ---------- the roof system a pro installs (also what the scroll build teaches) ---------- */
  const galv = new THREE.MeshStandardMaterial({ color: "#b7bcc2", metalness: 0.75, roughness: 0.32 });
  const iceMat = new THREE.MeshStandardMaterial({ color: "#1c1e22", roughness: 0.55 });
  const starterMat = new THREE.MeshStandardMaterial({ color: "#2a2b2e", roughness: 0.9 });
  const tapeMat = new THREE.MeshStandardMaterial({ color: "#39414f", roughness: 0.5 });
  const SYS = { drip: new THREE.Group(), ice: new THREE.Group(), valley: new THREE.Group(), starter: new THREE.Group(),
    step: new THREE.Group(), pipe: new THREE.Group(), ridgeVent: new THREE.Group(), tape: new THREE.Group(), soffit: new THREE.Group() };
  Object.values(SYS).forEach((g) => root.add(g));

  // a sub-rectangle of a roof plane: along-eave [x0,x1], up-slope [s0,s1]
  const band = (pl, s0, s1, inset, mat, g, x0 = 0, x1 = pl.L) => {
    const at = (x, sv) => pl.p0.clone().addScaledVector(pl.ed, x).addScaledVector(pl.ud, sv).addScaledVector(pl.n, inset);
    const pts = [at(x0, s0), at(x1, s0), at(x1, s1), at(x0, s1)];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts.flatMap((v) => [v.x, v.y, v.z]), 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; g.add(m); return m;
  };
  const RAKES = { mainFront: ["start", "end"], mainBack: ["start", "end"], bayL: ["end"], bayR: ["start"], garFront: ["end"], garBack: ["start"], porch: ["end"] };
  for (const pl of planes) {
    // drip edge: eaves + open rakes, hanging just past the deck edge
    const out = pl.n.clone().multiplyScalar(-0.06).addScaledVector(pl.ud, -0.08);
    beam(pl.p0.clone().add(out), pl.p0.clone().addScaledVector(pl.ed, pl.L).add(out), 0.12, 0.3, galv, SYS.drip);
    for (const side of RAKES[pl.id] || []) {
      const base = side === "start" ? pl.p0.clone() : pl.p0.clone().addScaledVector(pl.ed, pl.L);
      const o = pl.ed.clone().multiplyScalar(side === "start" ? -0.08 : 0.08).addScaledVector(pl.n, 0.02);
      beam(base.clone().add(o), base.clone().addScaledVector(pl.ud, pl.S).add(o), 0.12, 0.28, galv, SYS.drip);
    }
    // ice & water shield: first 3.5 ft up from the eave
    band(pl, 0, Math.min(3.5, pl.S), 0.03, iceMat, SYS.ice);
    // starter strip at the eave
    band(pl, 0, 0.75, 0.066, starterMat, SYS.starter);
  }
  // valleys where the front gable roof meets the main roof
  const valleyPts = [[V(-17, MAIN.eave - BAY.pitch, 15.24), V(-10, BAY_RIDGE, 6.5)], [V(-3, MAIN.eave - BAY.pitch, 15.24), V(-10, BAY_RIDGE, 6.5)]];
  for (const [a, b] of valleyPts) {
    beam(a.clone().add(V(0, 0.06, 0)), b.clone().add(V(0, 0.06, 0)), 3, 0.02, iceMat, SYS.ice);
    beam(a.clone().add(V(0, 0.1, 0)), b.clone().add(V(0, 0.1, 0)), 1.5, 0.03, galv, SYS.valley);
  }
  // step flashing where the garage roof dies into the main wall, headwall flashing at the porch
  const gY0 = GAR.eave - 1.2 * GAR.pitch;
  beam(V(18.06, gY0 + 0.35, GAR.z1 + 1.2), V(18.06, GAR_RIDGE + 0.35, -1), 0.06, 0.65, galv, SYS.step);
  beam(V(18.06, gY0 + 0.35, GAR.z0 - 1.2), V(18.06, GAR_RIDGE + 0.35, -1), 0.06, 0.65, galv, SYS.step);
  const stepMat = new THREE.MeshStandardMaterial({ color: "#8d9298" });
  for (let z = 10.6; z > -0.5; z -= 0.42) box(0.06, 0.08, 0.02, stepMat, 18.07, gY0 + 0.05 + (GAR.z1 + 1.2 - z) * (5.08 / 12.2), z, SYS.step);
  box(PORCH.x1 - PORCH.x0, 0.55, 0.06, galv, (PORCH.x0 + PORCH.x1) / 2, PORCH.top + 0.25, MAIN.z1 + 0.06, SYS.step);
  // plumbing vent + pipe boot on the front roof plane
  {
    const front = planes.find((p) => p.id === "mainFront");
    const sv = (15.5 - 7) / 0.832, base = front.p0.clone().addScaledVector(front.ed, 29).addScaledVector(front.ud, sv);
    const q = new THREE.Quaternion().setFromRotationMatrix(basis(front.ed, front.n));
    const plate = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.7, 0.04), galv);
    plate.position.copy(base).addScaledVector(front.n, 0.12); plate.quaternion.copy(q); plate.castShadow = true; SYS.pipe.add(plate);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.42, 0.55, 18), new THREE.MeshStandardMaterial({ color: "#151617", roughness: 0.7 }));
    collar.position.copy(base).add(V(0, 0.32, 0)); collar.castShadow = true; SYS.pipe.add(collar);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.5, 18), new THREE.MeshStandardMaterial({ color: "#e9e7e1", roughness: 0.5 }));
    pipe.position.copy(base).add(V(0, 0.85, 0)); pipe.castShadow = true; SYS.pipe.add(pipe);
  }
  // ridge vent
  box(36, 0.22, 1.25, new THREE.MeshStandardMaterial({ color: "#222326", roughness: 0.8 }), 0, RIDGE_Y + 0.12, 0, SYS.ridgeVent);
  const ventSlot = new THREE.MeshStandardMaterial({ color: "#0d0d0e" });
  for (let x = -17.5; x < 18; x += 0.5) box(0.08, 0.12, 1.3, ventSlot, x, RIDGE_Y + 0.1, 0, SYS.ridgeVent);
  // vented soffit slots
  const slot = new THREE.MeshStandardMaterial({ color: "#3a3c40", roughness: 0.9 });
  for (const z of [14.8, -14.8]) for (let x = -18; x < 18.5; x += 2.4) box(1.5, 0.04, 0.35, slot, x, MAIN.eave - 1.5 * PITCH - 0.82, z, SYS.soffit);

  /* ---------- porch ---------- */
  const porch = new THREE.Group(); root.add(porch);
  box(PORCH.x1 - PORCH.x0, 0.35, 7, M.porchFloor, (PORCH.x0 + PORCH.x1) / 2, PORCH.floor - 0.17, 17.5, porch);
  box(PORCH.x1 - PORCH.x0, PORCH.floor - 0.35, 0.3, M.stone, (PORCH.x0 + PORCH.x1) / 2, (PORCH.floor - 0.35) / 2, 21, porch);
  for (let i = 0; i < 3; i++) box(5, 0.5, 1.1, M.concrete, 4, PORCH.floor - 0.5 - i * 0.5 + 0.25, 21.6 + i * 1.1, porch);
  // ceiling
  const cg = roofQuad(planes.find((p) => p.id === "porch"), -0.35);
  const ceilMesh = new THREE.Mesh(cg, M.ceiling);
  ceilMesh.material.side = THREE.BackSide;
  porch.add(ceilMesh);
  box(PORCH.x1 - PORCH.x0 + 0.5, 0.9, 0.5, M.trim, (PORCH.x0 + PORCH.x1) / 2, pY - 0.6, 21, porch);
  // stone piers + tapered craftsman columns
  const piers = [];
  for (const x of [-3.3, 7.4, 13.8]) {
    piers.push(box(1.6, 3.2, 1.6, M.stone, x, PORCH.floor + 1.6, 20.6, porch));
    box(1.8, 0.25, 1.8, M.trim, x, PORCH.floor + 3.3, 20.6, porch);
    const colm = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.62, pY - PORCH.floor - 4, 4, 1), M.trim);
    colm.rotation.y = Math.PI / 4;
    colm.position.set(x, PORCH.floor + 3.4 + (pY - PORCH.floor - 4) / 2, 20.6);
    colm.castShadow = true; porch.add(colm);
    box(1.4, 0.3, 1.4, M.trim, x, pY - 0.9, 20.6, porch);
  }
  // simple rail between piers (right bay)
  box(5.1, 0.25, 0.3, M.trim, 10.6, PORCH.floor + 2.8, 20.6, porch);
  for (let i = 0; i < 13; i++) box(0.12, 2.4, 0.12, M.trim, 8.4 + i * 0.37, PORCH.floor + 1.5, 20.6, porch);

  /* ---------- openings: windows, door, garage ---------- */
  const winG = new THREE.Group(); root.add(winG);
  const grids = { colonial: [], prairie: [], craftsman: [] };
  const glows = [];
  for (const w of W) {
    const toWorld = (lx, ly, d) => w.o.clone().addScaledVector(w.u, lx).addScaledVector(UP, ly).addScaledVector(w.n, d);
    const q = new THREE.Quaternion().setFromRotationMatrix(basis(w.u, w.n));
    const part = (bw, bh, bd, mat, lx, ly, d) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), mat);
      m.position.copy(toWorld(lx, ly, d)); m.quaternion.copy(q);
      m.castShadow = true; m.receiveShadow = true;
      winG.add(m);
      return m;
    };
    for (const [x, y, ww, hh, cols] of w.win || []) {
      // casing
      part(ww + 0.9, 0.45, 0.16, M.trim, x + ww / 2, y + hh + 0.22, 0.14);
      part(ww + 1.1, 0.22, 0.4, M.trim, x + ww / 2, y - 0.1, 0.22); // sill
      part(0.45, hh, 0.16, M.trim, x - 0.22, y + hh / 2, 0.14);
      part(0.45, hh, 0.16, M.trim, x + ww + 0.22, y + hh / 2, 0.14);
      // glass (recessed) + glow
      part(ww, hh, 0.05, M.glass, x + ww / 2, y + hh / 2, -0.15);
      const gl = part(ww - 0.2, hh - 0.2, 0.02, M.glow, x + ww / 2, y + hh / 2, -0.11);
      glows.push(gl);
      // sash frames per column
      const cw = ww / cols;
      for (let k = 0; k < cols; k++) {
        const cx = x + cw * k;
        part(cw, 0.22, 0.2, M.frame, cx + cw / 2, y + 0.11, -0.05);
        part(cw, 0.22, 0.2, M.frame, cx + cw / 2, y + hh - 0.11, -0.05);
        part(0.22, hh, 0.2, M.frame, cx + 0.11, y + hh / 2, -0.05);
        part(0.22, hh, 0.2, M.frame, cx + cw - 0.11, y + hh / 2, -0.05);
        part(cw - 0.3, 0.16, 0.16, M.frame, cx + cw / 2, y + hh * 0.5, -0.04); // meeting rail
        // grids
        const gx = (kind, lx, ly, gw, gh) => grids[kind].push(part(gw, gh, 0.06, M.frame, lx, ly, -0.08));
        for (const fy of [0.25, 0.75]) {
          gx("colonial", cx + cw / 2, y + hh * fy, 0.07, hh * 0.5 - 0.2);
          gx("colonial", cx + cw / 2, y + hh * fy, cw - 0.3, 0.07);
        }
        for (const dx of [0.3, cw - 0.3]) gx("prairie", cx + dx, y + hh * 0.75, 0.07, hh * 0.5 - 0.2);
        gx("prairie", cx + cw / 2, y + hh - 0.4, cw - 0.3, 0.07);
        gx("prairie", cx + cw / 2, y + hh * 0.5 + 0.3, cw - 0.3, 0.07);
        for (const fx of [1 / 3, 2 / 3]) gx("craftsman", cx + cw * fx, y + hh * 0.75, 0.07, hh * 0.5 - 0.2);
      }
    }
    for (const [x, y, ww, hh] of w.garage || []) {
      const gt = TX.garageDoor();
      M.garage = M.garage || new THREE.MeshStandardMaterial({ map: gt.map, bumpMap: gt.bump, bumpScale: 4, roughness: 0.5, color: "#f4f3ee" });
      part(ww, hh, 0.15, M.garage, x + ww / 2, y + hh / 2, -0.2);
      part(ww + 1, 0.55, 0.18, M.trim, x + ww / 2, y + hh + 0.27, 0.14);
      part(0.5, hh, 0.18, M.trim, x - 0.25, y + hh / 2, 0.14);
      part(0.5, hh, 0.18, M.trim, x + ww + 0.25, y + hh / 2, 0.14);
      // carriage lights
      for (const lx of [x - 1.4, x + ww + 1.4]) {
        part(0.5, 0.9, 0.35, M.lamp, lx, y + hh - 0.6, 0.35);
      }
    }
    if (w.door) {
      const [x, y, ww, hh] = w.door[0];
      const sl = 1.1, dw = ww - sl * 2;
      part(ww + 1, 0.5, 0.18, M.trim, x + ww / 2, y + hh + 0.25, 0.14);
      part(0.5, hh, 0.18, M.trim, x - 0.25, y + hh / 2, 0.14);
      part(0.5, hh, 0.18, M.trim, x + ww + 0.25, y + hh / 2, 0.14);
      for (const sx of [x + sl / 2, x + ww - sl / 2]) {
        part(sl, hh, 0.1, M.glass, sx, y + hh / 2, -0.2);
        part(0.2, hh, 0.2, M.trim, sx - sl / 2 + 0.1, y + hh / 2, -0.05);
        part(0.2, hh, 0.2, M.trim, sx + sl / 2 - 0.1, y + hh / 2, -0.05);
        part(sl, 1.6, 0.2, M.trim, sx, y + 0.8, -0.05);
      }
      M.doorGroup = new THREE.Group(); winG.add(M.doorGroup);
      const dg = M.doorGroup;
      dg.position.copy(toWorld(x + ww / 2, y, -0.12)); dg.quaternion.copy(q);
      M.doorStyles = {};
      const d = (style, parts) => { const g = new THREE.Group(); parts(g); g.visible = false; dg.add(g); M.doorStyles[style] = g; };
      const pb = (g, bw, bh, bd, mat, px, py, pz) => { const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), mat); m.position.set(px, py, pz); m.castShadow = true; g.add(m); };
      d("craftsman", (g) => {
        pb(g, dw, hh, 0.18, M.door, 0, hh / 2, 0);
        for (let i = 0; i < 3; i++) pb(g, dw / 3 - 0.2, 1.4, 0.04, M.glass, -dw / 3 + i * (dw / 3), hh - 1.2, 0.1);
        pb(g, dw - 0.2, 0.18, 0.05, M.door, 0, hh - 2.05, 0.11);
        for (let i = 0; i < 2; i++) pb(g, dw / 2 - 0.35, 2.4, 0.05, M.door, -dw / 4 + i * dw / 2, 2.0, 0.11);
        pb(g, 0.12, 0.7, 0.12, M.hardware, dw / 2 - 0.4, 3.4, 0.2);
      });
      d("modern", (g) => {
        pb(g, dw, hh, 0.18, M.door, 0, hh / 2, 0);
        pb(g, 0.55, hh - 1.2, 0.04, M.glass, -dw / 2 + 0.6, hh / 2, 0.1);
        pb(g, 0.1, 3.2, 0.25, M.hardware, dw / 2 - 0.45, 3.6, 0.22);
      });
      d("panel", (g) => {
        pb(g, dw, hh, 0.18, M.door, 0, hh / 2, 0);
        for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) pb(g, dw / 2 - 0.5, r === 0 ? 1.2 : 1.9, 0.05, M.door, -dw / 4 + c * (dw / 2), [5.8, 3.9, 1.5][r], 0.11);
        pb(g, 0.15, 0.15, 0.15, M.hardware, dw / 2 - 0.4, 3.3, 0.2);
      });
      // porch sconce
      part(0.45, 0.8, 0.3, M.lamp, x - 1.2, y + 5.6, 0.32);
    }
  }

  /* ---------- window flashing tape (wrap phase) ---------- */
  for (const w of W) {
    const q = new THREE.Quaternion().setFromRotationMatrix(basis(w.u, w.n));
    const put = (lx, ly, bw, bh) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.01), tapeMat);
      m.position.copy(w.o).addScaledVector(w.u, lx).addScaledVector(UP, ly).addScaledVector(w.n, 0.055); m.quaternion.copy(q);
      SYS.tape.add(m);
    };
    for (const [x, y, ww, hh] of w.win || []) {
      const t = 0.75;
      put(x + ww / 2, y - t / 2, ww + 2 * t, t);         // sill
      put(x - t / 2, y + hh / 2, t, hh);                  // jambs
      put(x + ww + t / 2, y + hh / 2, t, hh);
      put(x + ww / 2, y + hh + t / 2, ww + 2 * t, t);   // head
    }
  }

  /* ---------- chimney ---------- */
  const chim = new THREE.Group(); root.add(chim);
  box(2.8, 32, 5, M.chimney, -19.6, 16, -0.5, chim);
  box(3.4, 0.4, 5.6, M.concrete, -19.6, 32.2, -0.5, chim);
  box(0.9, 1, 0.9, new THREE.MeshStandardMaterial({ color: "#3a3a3a" }), -19.6, 32.9, -0.5, chim);

  /* ---------- stone accents (wainscot) ---------- */
  const accent = new THREE.Group(); root.add(accent);
  const wains = (x, z, w, d, h) => { const b = box(w, h, d, M.stone, x, MAIN.sill + h / 2 - 0.05, z, accent); return b; };
  wains(-10, BAY.z + 0.18, 12.6, 0.35, 2.4);
  wains(BAY.x0 - 0.18, 16, 0.35, 4.3, 2.4);
  wains(BAY.x1 + 0.18, 16, 0.35, 4.3, 2.4);
  wains(19.75, GAR.z1 + 0.18, 3.6, 0.35, 2.4).position.y = GAR.sill + 1.15;
  wains(38.3, GAR.z1 + 0.18, 3.6, 0.35, 2.4).position.y = GAR.sill + 1.15;
  box(12.8, 0.2, 0.55, M.trim, -10, MAIN.sill + 2.45, BAY.z + 0.25, accent);

  /* ---------- dusk lights ---------- */
  const lights = [];
  for (const [x, y, z, d] of [[1.7, 7.2, 14.8, 14], [20.4, 7.8, 10.8, 14], [37.6, 7.8, 10.8, 14], [4, 9, 18, 18]]) {
    const L = new THREE.PointLight("#ffc779", 0, d, 1.6);
    L.position.set(x, y, z); root.add(L); lights.push(L);
  }

  /* ================================================================ API */
  const api = { root, planes, walls: W, strips, stripMesh, finals, M, roofLayers, wallLayers };

  api.setDesign = (d) => {
    const { roof, siding, trim, windows, door, gutters, accents } = d;
    const metal = roof.type === "metal";
    stripMat.color.set(roof.hex); capMat.color.set(roof.hex);
    metalMat.color.set(roof.hex);
    stripMesh.visible = !metal; capG.visible = !metal;
    roofLayers.metal.forEach((m) => (m.visible = metal));
    const sm = newSidingMats[siding.profile] || newSidingMats.lap;
    sm.color.set(siding.hex);
    sidingMeshes.forEach((m) => (m.material = sm));
    M.trim.color.set(trim.hex);
    if (M.garage) M.garage.color.set(trim.hex);
    M.frame.color.set(windows.hex);
    for (const k of Object.keys(grids)) grids[k].forEach((m) => (m.visible = k === windows.grid));
    M.door.color.set(door.hex);
    for (const [k, g] of Object.entries(M.doorStyles)) g.visible = k === (door.style || "craftsman");
    M.gutter.color.set(gutters.hex);
    M.gutter.metalness = gutters.name === "Copper" ? 0.8 : 0.2;
    accent.visible = !!accents.hex;
    if (accents.hex) M.stone.color.set(accents.hex);
    piers.forEach((p) => (p.material = accents.hex ? M.stone : M.trim));
  };

  // finished house shows only what's visible on a real finished roof
  const showFinished = () => {
    SYS.ice.visible = SYS.starter.visible = SYS.valley.visible = SYS.tape.visible = false;
    SYS.drip.visible = SYS.step.visible = SYS.pipe.visible = SYS.ridgeVent.visible = SYS.soffit.visible = true;
    capMain.visible = true;
  };
  if (!build) showFinished();
  api.anchors = SYS;

  api.setDusk = (t) => {
    M.glow.opacity = t * 0.85;
    glows.forEach((g) => (g.visible = t > 0.01));
    M.lamp.emissiveIntensity = t * 3;
    lights.forEach((l) => (l.intensity = t * 60));
  };

  /* --- build animation (scroll) --- */
  const tmpM = new THREE.Matrix4(), tmpP = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3();
  const setPlane = (mat, normal, constant) => { mat.clippingPlanes[0].set(normal, constant); };

  if (build) {
    // debris: old shingle chunks + old siding planks (instanced, fall when the tear line passes)
    const deb = [];
    const pick = (pl) => {
      for (let k = 0; k < 20; k++) {
        const x = Math.random() * pl.L, s = Math.random() * pl.S;
        const p = pl.p0.clone().addScaledVector(pl.ed, x).addScaledVector(pl.ud, s).addScaledVector(pl.n, 0.1);
        if (!pl.hidden || !pl.hidden(p)) return { p, s };
      }
      return null;
    };
    planes.forEach((pl, pi) => {
      const n = Math.round(pl.L * pl.S / 4.5);
      for (let i = 0; i < n; i++) {
        const r = pick(pl); if (!r) continue;
        deb.push({ kind: "roof", pi, p: r.p, at: 1 - r.s / pl.S, n: pl.n, w: 0.8 + Math.random() * 1.6, h: 0.4 + Math.random() * 0.6,
          axis: V(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(), spin: 3 + Math.random() * 6, drift: 2 + Math.random() * 5 });
      }
    });
    W.forEach((w) => {
      const n = Math.round(w.w * w.h / 14);
      for (let i = 0; i < n; i++) {
        const lx = Math.random() * w.w, ly = Math.random() * w.h;
        const inHole = [...(w.win || []), ...(w.door || []), ...(w.garage || [])].some(([x, y, ww, hh]) => lx > x - 0.5 && lx < x + ww + 0.5 && ly > y - 0.5 && ly < y + hh + 0.5);
        if (inHole) continue;
        const p = w.o.clone().addScaledVector(w.u, lx).addScaledVector(UP, ly).addScaledVector(w.n, 0.15);
        deb.push({ kind: "wall", p, y: p.y, n: w.n, u: w.u, w: 2 + Math.random() * 5, h: 0.58,
          axis: V(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(), spin: 1 + Math.random() * 2.5, drift: 1 + Math.random() * 3 });
      }
    });
    const roofDeb = deb.filter((d) => d.kind === "roof"), wallDeb = deb.filter((d) => d.kind === "wall");
    const mkInst = (list, mat) => {
      const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 0.05), mat, list.length);
      im.castShadow = true; im.frustumCulled = false;
      for (let i = 0; i < list.length; i++) im.setMatrixAt(i, tmpM.makeScale(0, 0, 0));
      root.add(im);
      return im;
    };
    const roofDebMat = oldRoofMat.clone(); roofDebMat.map = oldRoofMat.map;
    const roofInst = mkInst(roofDeb, roofDebMat);
    const wallInst = mkInst(wallDeb, oldSidingMat);

    const fall = (im, list, t0, t1, life, P, cutAt) => {
      for (let i = 0; i < list.length; i++) {
        const d = list[i];
        const start = t0 + cutAt(d) * (t1 - t0);
        const a = (P - start) / life;
        if (a <= 0 || a >= 1) { im.setMatrixAt(i, tmpM.makeScale(0, 0, 0)); continue; }
        const horiz = V(d.n.x, 0, d.n.z).normalize();
        tmpP.copy(d.p).addScaledVector(d.n, 1.5 * a).addScaledVector(horiz, d.drift * a);
        tmpP.y = Math.max(0.1, d.p.y + 2 * a - a * a * (d.p.y + 2));
        tmpQ.setFromRotationMatrix(d.kind === "roof" ? basis(planes[d.pi].ed, d.n) : basis(d.u, d.n));
        tmpQ.premultiply(new THREE.Quaternion().setFromAxisAngle(d.axis, d.spin * a));
        const sc = a > 0.85 ? (1 - a) / 0.15 : 1;
        tmpS.set(d.w * sc, d.h * sc, sc);
        im.setMatrixAt(i, tmpM.compose(tmpP, tmpQ, tmpS));
      }
      im.instanceMatrix.needsUpdate = true;
    };

    const yTop = RIDGE_Y + 0.5;
    api.setBuild = (T, P) => {
      const seg = (a, b) => Math.min(1, Math.max(0, (P - a) / (b - a)));
      const ease = (t) => 1 - Math.pow(1 - t, 3);

      // roof: old tear-off ridge → eave (keep below cut)
      const off = seg(...T.roofOff);
      planes.forEach((pl, i) => {
        const pd = pl.ud.dot(pl.p0);
        setPlane(roofLayers.old[i].material, pl.ud.clone().negate(), pd + pl.S * (1 - off) + (off === 0 ? 1 : 0));
        roofLayers.old[i].visible = off < 1;
        const un = seg(...T.under);
        setPlane(roofLayers.under[i].material, pl.ud.clone().negate(), pd + pl.S * un - (un === 0 ? 1 : 0));
        roofLayers.under[i].visible = un > 0;
      });
      fall(roofInst, roofDeb, T.roofOff[0], T.roofOff[1], 0.05, P, (d) => d.at);

      // new shingles: eave → ridge, racked
      const on = seg(...T.roofOn);
      for (let i = 0; i < strips.length; i++) {
        const st = strips[i];
        const start = (st.c / st.courses) * 0.86 + ((st.c % 4) * 0.004) + st.x * 0.03;
        const a = Math.min(1, Math.max(0, (on - start) / 0.06));
        if (a <= 0) { stripMesh.setMatrixAt(i, tmpM.makeScale(0, 0, 0)); continue; }
        if (a >= 1) { stripMesh.setMatrixAt(i, finals[i]); continue; }
        finals[i].decompose(tmpP, tmpQ, tmpS);
        const e = ease(a), pl = planes[st.pi];
        tmpP.addScaledVector(pl.n, (1 - e) * 1.4).addScaledVector(pl.ud, (1 - e) * 0.8);
        stripMesh.setMatrixAt(i, tmpM.compose(tmpP, tmpQ, tmpS));
      }
      stripMesh.instanceMatrix.needsUpdate = true;
      capG.visible = on >= 1;
      const after = (k) => P >= T[k][0];
      SYS.drip.visible = after("drip");
      SYS.ice.visible = after("ice");
      SYS.valley.visible = after("valley");
      SYS.starter.visible = after("starter");
      SYS.step.visible = after("step");
      SYS.pipe.visible = after("pipe");
      SYS.ridgeVent.visible = after("ridgeVent");
      capMain.visible = after("ridgeCap");
      SYS.tape.visible = after("tape");
      SYS.soffit.visible = P < T.roofOff[0] || after("finish");

      // walls: old siding top → bottom
      const so = seg(...T.sidingOff);
      const cut = yTop - so * (yTop + 0.5);
      wallLayers.old.forEach((m) => { setPlane(m.material, V(0, -1, 0), cut); m.visible = so < 1; });
      fall(wallInst, wallDeb, T.sidingOff[0], T.sidingOff[1], 0.06, P, (d) => 1 - d.y / yTop);
      const wr = seg(...T.wrap);
      wallLayers.wrap.forEach((m) => { setPlane(m.material, V(0, -1, 0), wr * yTop - (wr === 0 ? 1 : 0)); m.visible = wr > 0; });
      const sn = seg(...T.sidingOn);
      const ny = Math.floor((sn * yTop) / (7 / 12)) * (7 / 12);
      Object.values(newSidingMats).forEach((m) => setPlane(m, V(0, -1, 0), sn >= 1 ? 999 : ny - (sn === 0 ? 1 : 0)));

      // trim & gutters: old ones off during tear-off, new ones on at the end
      const gOn = P < T.roofOff[0] || P > T.finish[0];
      gutG.visible = gOn;
    };
  }

  return api;
}

export const HOUSE_CENTER = V(8, 10, 0);
