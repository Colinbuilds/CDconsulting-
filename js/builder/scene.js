/* Building designer: the 3D model built from the document, an orbit / walk-through viewer,
   and line-drawing renders (elevations, roof plan) for the print set. */
import * as THREE from "three";
import { OrbitControls } from "three/addons/OrbitControls.js";
import { PointerLockControls } from "three/addons/PointerLockControls.js";
import { createStage, NO_AO } from "../3d/stage.js";
import * as TX from "../3d/textures.js";
import * as C from "./core.js";
import { ASSEMBLIES, ITEMS, RUNS, FLOORS } from "./catalog.js";

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/* ---------- materials ---------- */
function canvasTex(w, h, draw, sizeFt) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  t.repeat.set(1 / sizeFt[0], 1 / sizeFt[1]);
  return t;
}
const brickTex = (hex) => canvasTex(512, 512, (g, W, H) => {
  g.fillStyle = "#cfc9bf"; g.fillRect(0, 0, W, H);
  const rows = 16, bh = H / rows, bw = W / 4;
  for (let r = 0; r < rows; r++) for (let i = -1; i < 5; i++) {
    const x = i * bw + (r % 2 ? bw / 2 : 0), k = 0.85 + Math.random() * 0.3;
    const c = new THREE.Color(hex).multiplyScalar(k);
    g.fillStyle = `#${c.getHexString()}`; g.fillRect(x + 3, r * bh + 3, bw - 6, bh - 6);
  }
}, [32 / 12 * 4 / 4 * 2.67, 2.67 * 16 / 16 * 16 / 12 * 2]);
const blockTex = () => canvasTex(512, 512, (g, W, H) => {
  g.fillStyle = "#c8c5bf"; g.fillRect(0, 0, W, H);
  const rows = 6, bh = H / rows, bw = W / 3;
  for (let r = 0; r < rows; r++) for (let i = -1; i < 4; i++) {
    const x = i * bw + (r % 2 ? bw / 2 : 0), k = 0.93 + Math.random() * 0.1;
    g.fillStyle = `rgba(${Math.round(225 * k)},${Math.round(222 * k)},${Math.round(215 * k)},1)`; g.fillRect(x + 3, r * bh + 3, bw - 6, bh - 6);
  }
}, [4, 4]);
const tileTex = (hex) => canvasTex(256, 256, (g, W, H) => {
  g.fillStyle = "#9d978d"; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { const c = new THREE.Color(hex).multiplyScalar(0.95 + Math.random() * 0.08); g.fillStyle = `#${c.getHexString()}`; g.fillRect(i * W / 2 + 2, j * H / 2 + 2, W / 2 - 4, H / 2 - 4); }
}, [2, 2]);

function texMat(t, color, opts = {}) {
  const map = t.map.clone(); map.needsUpdate = true;
  const s = t.size || 4; map.repeat.set(1 / s, 1 / s);
  const m = new THREE.MeshStandardMaterial({ map, color, roughness: 0.75, ...opts });
  if (t.bump) { const b = t.bump.clone(); b.needsUpdate = true; b.repeat.copy(map.repeat); m.bumpMap = b; m.bumpScale = opts.bumpScale ?? 1.5; }
  return m;
}
function materials(doc) {
  const s = doc.settings;
  const M = {
    drywall: new THREE.MeshStandardMaterial({ color: "#f2f0ec", roughness: 0.92 }),
    cap: new THREE.MeshStandardMaterial({ color: "#d8d3c8", roughness: 0.9 }),
    trim: new THREE.MeshStandardMaterial({ color: s.trimColor, roughness: 0.55 }),
    concrete: new THREE.MeshStandardMaterial({ map: TX.photo("concrete", { repeat: 1 }), color: "#c9c6c0", roughness: 0.95 }),
    glass: new THREE.MeshPhysicalMaterial({ color: "#3b4b58", roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.55, clearcoat: 1 }),
    frame: new THREE.MeshStandardMaterial({ color: "#f3f3f0", roughness: 0.5 }),
    dark: new THREE.MeshStandardMaterial({ color: "#2b2e33", roughness: 0.5, metalness: 0.4 }),
    door: new THREE.MeshStandardMaterial({ color: "#3b2f27", roughness: 0.6 }),
    doorInt: new THREE.MeshStandardMaterial({ color: "#f5f4f0", roughness: 0.6 }),
    white: new THREE.MeshStandardMaterial({ color: "#f4f4f2", roughness: 0.4 }),
    steel: new THREE.MeshStandardMaterial({ color: "#b8bcc1", roughness: 0.35, metalness: 0.8 }),
    wood: new THREE.MeshStandardMaterial({ color: "#a37b52", roughness: 0.7 }),
    fabric: new THREE.MeshStandardMaterial({ color: "#7d8691", roughness: 0.95 }),
    linen: new THREE.MeshStandardMaterial({ color: "#ecebe6", roughness: 0.95 }),
    black: new THREE.MeshStandardMaterial({ color: "#1d1f22", roughness: 0.4 }),
    membrane: new THREE.MeshStandardMaterial({ color: s.roofMaterial === "epdm" ? "#2a2c2f" : "#eceeed", roughness: 0.7 }),
    deck: texMat(TX.boards("#8a6b4f", 77), "#ffffff", { roughness: 0.85 }),
    lawn: new THREE.MeshStandardMaterial({ map: TX.photo("lawn", { repeat: 60 }), color: "#88ad62", roughness: 1 }),
    ceiling: new THREE.MeshStandardMaterial({ color: "#f7f6f2", roughness: 0.95, side: THREE.DoubleSide }),
  };
  const prof = { lap: "lap", board: "board" };
  M.siding = (profile) => texMat(TX.siding(prof[profile] || "lap"), s.sidingColor, { roughness: 0.6 });
  M.brick = new THREE.MeshStandardMaterial({ map: brickTex(s.brickColor), roughness: 0.9 });
  M.stone = new THREE.MeshStandardMaterial({ map: TX.photo("stone", { repeat: 1 }), normalMap: TX.photo("stone-nor", { srgb: false, repeat: 1 }), roughness: 0.95 });
  M.stone.map.repeat.set(1 / 4, 1 / 4); M.stone.normalMap.repeat.set(1 / 4, 1 / 4);
  M.metal = texMat(TX.metalSeam(), "#9aa1a9", { roughness: 0.4, metalness: 0.6 });
  M.metal.map.rotation = Math.PI / 2;
  M.cmu = new THREE.MeshStandardMaterial({ map: blockTex(), roughness: 0.95 });
  M.storefront = M.dark;
  const roofT = s.roofMaterial === "metal" ? TX.metalSeam() : TX.shingleTile(3);
  M.roof = texMat(roofT, s.roofColor, { roughness: s.roofMaterial === "metal" ? 0.35 : 0.85, metalness: s.roofMaterial === "metal" ? 0.5 : 0, side: THREE.DoubleSide, bumpScale: 2 });
  M.floor = {};
  for (const [k, f] of Object.entries(FLOORS)) {
    M.floor[k] = k === "wood" || k === "lvp" ? texMat(TX.boards(f.hex, 33), "#ffffff", { roughness: 0.6 })
      : k === "tile" ? new THREE.MeshStandardMaterial({ map: tileTex(f.hex), roughness: 0.5 })
      : new THREE.MeshStandardMaterial({ color: f.hex, roughness: k === "carpet" ? 1 : 0.8 });
  }
  return M;
}
const finishMat = (M, asm) => {
  const A = ASSEMBLIES[asm] || {};
  return A.finish === "siding" ? M.siding(A.profile) : M[A.finish] || M.drywall;
};

/* ---------- geometry helpers ---------- */
// a box whose UVs are in feet, so tiled textures line up across pieces (u0/v0 offset the pattern)
function feetBox(w, h, d, mats, u0 = 0, v0 = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv, pos = g.attributes.position;
  for (let i = 0; i < uv.count; i++) {
    const face = Math.floor(i / 4), x = pos.getX(i) + w / 2, y = pos.getY(i) + h / 2, z = pos.getZ(i) + d / 2;
    if (face < 2) uv.setXY(i, z, y + v0);
    else if (face < 4) uv.setXY(i, x + u0, z);
    else uv.setXY(i, face === 4 ? x + u0 : w - x + u0, y + v0);
  }
  const m = new THREE.Mesh(g, mats);
  m.castShadow = m.receiveShadow = true;
  return m;
}
function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = m.receiveShadow = true;
  return m;
}
function cyl(r, h, mat, x, y, z, seg = 18, r2 = r) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r2, h, seg), mat);
  m.position.set(x, y, z); m.castShadow = m.receiveShadow = true;
  return m;
}
// triangles from flat [x,y,z,...] with UVs from a callback
function poly(tris, mat, uvOf) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(tris, 3));
  const uvs = [];
  for (let i = 0; i < tris.length; i += 3) uvs.push(...uvOf(tris[i], tris[i + 1], tris[i + 2]));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  m.castShadow = m.receiveShadow = true;
  return m;
}
const quad = (a, b, c, d) => [...a, ...b, ...c, ...a, ...c, ...d];

/* ---------- the model ---------- */
export function buildModel(doc, opt = {}) {
  const M = materials(doc), root = new THREE.Group(), lay = opt.layers || {};
  root.userData.materials = M;
  const roomsBy = doc.levels.map((_, L) => C.rooms(doc, L));

  doc.levels.forEach((lv, L) => {
    const rl = roomsBy[L];
    // ---- walls, openings, foundation ----
    for (const w of C.wallsOn(doc, L)) {
      const [a, b] = C.ends(doc, w), len = C.dist(a, b);
      if (len < 0.1) continue;
      const ux = (b.x - a.x) / len, uy = (b.y - a.y) / len, t = C.thick(w), H = w.h || lv.height, E = lv.elev;
      const side = C.outsideSide(doc, w, rl), A = ASSEMBLIES[w.asm] || {};
      const ext = finishMat(M, w.asm), intM = A.drywall === false && A.cmu ? M.cmu : M.drywall;
      const left = side === -1 ? intM : side === 1 ? ext : side === 2 ? ext : intM;
      const right = side === 1 ? intM : side === -1 ? ext : side === 2 ? ext : intM;
      const mats = [M.cap, M.cap, M.cap, M.cap, left, right];
      const g = new THREE.Group();
      g.position.set(a.x, 0, a.y);
      g.rotation.y = Math.atan2(-uy, ux);
      g.userData.pick = { kind: "wall", id: w.id };
      const ops = doc.openings.filter((o) => o.wall === w.id).sort((m, n) => m.t - n.t);
      const ext0 = side === 0 ? 0 : t / 2; // exterior walls run past the corner so corners close
      let s = -ext0;
      const piece = (s0, s1, y0, y1) => {
        if (s1 - s0 < 0.01 || y1 - y0 < 0.01) return;
        const m = feetBox(s1 - s0, y1 - y0, t, mats, s0, E + y0);
        m.position.set((s0 + s1) / 2, E + (y0 + y1) / 2, 0);
        m.userData.pick = g.userData.pick;
        g.add(m);
      };
      for (const o of ops) {
        piece(s, o.t, 0, H);
        if (o.sill > 0) piece(o.t, o.t + o.w, 0, o.sill);
        piece(o.t, o.t + o.w, o.sill + o.h, H);
        g.add(openingModel(o, t, E, M, side, opt.walk));
        s = o.t + o.w;
      }
      piece(s, len + ext0, 0, H);
      // exterior walls on the ground floor sit on a concrete foundation wall
      if (L === 0 && side !== 0 && E > 0.05) { const f = box(len + 2 * ext0, E + 0.5, t + 0.15, M.concrete, len / 2, (E - 0.5) / 2, 0); g.add(f); }
      root.add(g);
    }
    // ---- floors (with stair openings cut out) and ceilings ----
    const stairsBelow = L > 0 ? doc.objects.filter((o) => o.type === "stairs" && o.level === L - 1) : [];
    for (const r of rl) {
      const shape = new THREE.Shape(r.pts.map((p) => new THREE.Vector2(p.x, -p.y)));
      for (const st of stairsBelow) {
        if (!C.inside(st, r.pts)) continue;
        const sp = ITEMS.stairs, wd = st.w || sp.w, dd = st.d || sp.d, ang = (st.rot || 0) * Math.PI / 2;
        const corners = [[-wd / 2, -dd / 2], [wd / 2, -dd / 2], [wd / 2, dd / 2], [-wd / 2, dd / 2]].map(([x, y]) => new THREE.Vector2(st.x + x * Math.cos(ang) - y * Math.sin(ang), -(st.y + x * Math.sin(ang) + y * Math.cos(ang))));
        shape.holes.push(new THREE.Path(corners.reverse()));
      }
      const geo = new THREE.ExtrudeGeometry(shape, { depth: L === 0 ? 0.3 : 0.9, bevelEnabled: false });
      geo.rotateX(-Math.PI / 2);
      const fm = M.floor[r.floor] || M.floor.wood;
      const floor = new THREE.Mesh(geo, [fm, M.drywall]);
      // ExtrudeGeometry UVs are in shape units (feet), so floor textures tile at real size
      floor.position.y = lv.elev - (L === 0 ? 0.3 : 0.9);
      floor.receiveShadow = true;
      floor.userData.pick = { kind: "room", key: r.key, level: L };
      root.add(floor);
      if (opt.ceilings) {
        const cg = new THREE.ShapeGeometry(shape); cg.rotateX(-Math.PI / 2);
        const c = new THREE.Mesh(cg, M.ceiling); c.name = "ceiling"; c.layers.set(NO_AO); c.position.y = lv.elev + lv.height - 0.01; root.add(c);
      }
    }
  });

  // ---- roofs ----
  if (lay.roof !== false) for (const r of doc.roofs) root.add(roofModel(doc, r, M));

  // ---- items ----
  for (const o of doc.objects) {
    const spec = ITEMS[o.type];
    if (!spec) continue;
    const layer = { Plumbing: "plumbing", HVAC: "hvac", Electrical: "electrical", Furniture: "furniture", "Kitchen & laundry": "furniture" }[spec.group];
    if (layer && lay[layer] === false) continue;
    const g = itemModel(doc, o, spec, M);
    if (!g) continue;
    g.userData.pick = { kind: "item", id: o.id };
    g.traverse((m) => { m.userData.pick = g.userData.pick; });
    root.add(g);
  }
  // ---- systems runs (shown in x-ray) ----
  if (opt.systems) for (const run of doc.runs) {
    const spec = RUNS[run.system], lv = doc.levels[run.level];
    if (!spec || lay[spec.layer] === false || run.pts.length < 2) continue;
    const y = run.system === "duct" || run.system === "return" ? lv.elev + lv.height - 0.7 : run.system === "wire" ? lv.elev + lv.height - 0.25 : lv.elev + 0.4;
    const mat = new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.4, metalness: run.system.includes("duct") || run.system === "return" ? 0.6 : 0.1, emissive: spec.color, emissiveIntensity: 0.15 });
    for (let i = 1; i < run.pts.length; i++) {
      const [x0, z0] = run.pts[i - 1], [x1, z1] = run.pts[i], L = Math.hypot(x1 - x0, z1 - z0);
      const thickR = spec.width ? spec.width : run.system === "drain" ? 0.25 : 0.1;
      const m = spec.width ? box(L + thickR, thickR * 0.7, thickR, mat, 0, 0, 0) : new THREE.Mesh(new THREE.CylinderGeometry(thickR, thickR, L, 10), mat);
      m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
      if (spec.width) m.rotation.y = Math.atan2(-(z1 - z0), x1 - x0);
      else { m.rotation.z = Math.PI / 2; m.rotation.y = Math.atan2(-(z1 - z0), x1 - x0); }
      root.add(m);
    }
  }
  return root;
}

/* ---------- doors and windows (built in the wall's local frame: x along the wall, z = left normal) ---------- */
function openingModel(o, t, E, M, side, walk) {
  const g = new THREE.Group(), cx = o.t + o.w / 2, y0 = E + o.sill, fw = 0.25, depth = Math.min(t, 0.45);
  const outZ = side === 1 ? 1 : side === -1 ? -1 : 0;
  const frame = (mat = M.frame) => {
    g.add(box(o.w, fw, depth, mat, cx, y0 + o.h - fw / 2, 0));
    if (o.sill > 0) g.add(box(o.w, fw, depth, mat, cx, y0 + fw / 2, 0));
    g.add(box(fw, o.h, depth, mat, o.t + fw / 2, y0 + o.h / 2, 0));
    g.add(box(fw, o.h, depth, mat, o.t + o.w - fw / 2, y0 + o.h / 2, 0));
  };
  // exterior casing
  if (outZ && o.type !== "opening") {
    const z = outZ * (t / 2 + 0.04), cw = 0.33;
    g.add(box(o.w + 2 * cw, cw, 0.08, M.trim, cx, y0 + o.h + cw / 2, z));
    g.add(box(cw, o.h, 0.08, M.trim, o.t - cw / 2, y0 + o.h / 2, z));
    g.add(box(cw, o.h, 0.08, M.trim, o.t + o.w + cw / 2, y0 + o.h / 2, z));
    if (o.type === "window") g.add(box(o.w + 2 * cw + 0.2, 0.15, 0.45, M.trim, cx, y0 - 0.08, outZ * (t / 2 + 0.15)));
  }
  if (o.type === "window") {
    const store = o.style === "storefront";
    frame(store ? M.dark : M.frame);
    g.add(box(o.w - 2 * fw, o.h - 2 * fw, 0.05, M.glass, cx, y0 + o.h / 2, 0));
    if (o.style === "double-hung") g.add(box(o.w - 2 * fw, 0.12, depth * 0.6, M.frame, cx, y0 + o.h / 2, 0));
    if (o.style === "slider" || o.style === "casement") g.add(box(0.12, o.h - 2 * fw, depth * 0.6, M.frame, cx, y0 + o.h / 2, 0));
    if (store) for (let x = o.t + 5; x < o.t + o.w - 1; x += 5) g.add(box(0.2, o.h, depth, M.dark, x, y0 + o.h / 2, 0));
  } else if (o.type === "door") {
    frame(o.style === "storefront" || o.style === "patio" ? M.dark : M.frame);
    if (o.style === "garage" || o.style === "overhead") {
      const p = box(o.w - 0.3, o.h - 0.2, 0.15, o.style === "garage" ? M.white : M.steel, cx, y0 + o.h / 2, 0);
      g.add(p);
      for (let k = 1; k < 4; k++) g.add(box(o.w - 0.3, 0.05, 0.18, M.cap, cx, y0 + (o.h * k) / 4, 0));
    } else if (o.style === "patio" || o.style === "storefront" || o.style === "french") {
      const half = (o.w - 2 * fw) / 2;
      for (const k of [0, 1]) {
        const x = o.t + fw + half * (k + 0.5);
        g.add(box(half - 0.1, o.h - fw, 0.08, M.glass, x, y0 + (o.h - fw) / 2, 0));
        g.add(box(half, 0.2, 0.15, o.style === "french" ? M.frame : M.dark, x, y0 + 0.1, 0));
      }
    } else {
      // swinging door: hinged at one jamb, swung open in walk mode
      const hinge = new THREE.Group(), hx = o.hinge ? o.t + o.w - fw : o.t + fw;
      hinge.position.set(hx, y0, 0);
      const dw = o.w - 2 * fw, slab = box(dw, o.h - fw, 0.15, o.style === "entry" ? M.door : M.doorInt, (o.hinge ? -1 : 1) * dw / 2, (o.h - fw) / 2, 0);
      hinge.add(slab);
      hinge.add(cyl(0.06, 0.05, M.steel, (o.hinge ? -1 : 1) * (dw - 0.3), 3, 0.1 * (o.swing || 1)));
      if (walk) hinge.rotation.y = (o.hinge ? 1 : -1) * (o.swing || 1) * 1.4;
      g.add(hinge);
    }
  }
  return g;
}

/* ---------- roofs ---------- */
function roofModel(doc, r, M) {
  const g = new THREE.Group(), Z = C.roofBase(doc, r), o = r.overhang, p = r.pitch / 12, f = Math.sqrt(1 + p * p);
  const x0 = r.x - o, x1 = r.x + r.w + o, y0 = r.y - o, y1 = r.y + r.d + o, ze = Z - o * p;
  g.userData.pick = { kind: "roof", id: r.id };
  if (r.type === "flat") {
    const slab = box(r.w, 0.9, r.d, doc.settings.roofMaterial === "epdm" || doc.settings.roofMaterial === "tpo" ? M.membrane : M.roof, r.x + r.w / 2, Z + 0.15, r.y + r.d / 2);
    g.add(slab);
    if (r.parapet) {
      const t = 0.7, h = r.parapet, wall = M.cmu;
      for (const [w, d, x, y] of [[r.w, t, r.x + r.w / 2, r.y + t / 2], [r.w, t, r.x + r.w / 2, r.y + r.d - t / 2], [t, r.d, r.x + t / 2, r.y + r.d / 2], [t, r.d, r.x + r.w - t / 2, r.y + r.d / 2]]) {
        g.add(box(w, h, d, wall, x, Z + h / 2, y));
        g.add(box(w + 0.2, 0.25, d + 0.2, M.steel, x, Z + h + 0.12, y));
      }
    } else if (o > 0) g.add(box(r.w + 2 * o, 0.6, r.d + 2 * o, M.trim, r.x + r.w / 2, Z - 0.1, r.y + r.d / 2));
    return g;
  }
  const H = (x, y) => C.roofHeightAt(doc, r, x, y);
  const P = (x, y) => [x, H(x, y), y];
  // UVs: u along the eave, v up the slope (feet), so shingle courses run level
  const uvAlong = (axis, e0) => (x, y, z) => [axis === "x" ? x : z, ((y - ze) * f) / Math.max(p, 0.01) + e0];
  const add = (pts, uv) => g.add(poly(pts, M.roof, uv));
  if (r.type === "shed") {
    const along = r.ridge === "x";
    add(along ? quad(P(x0, y1), P(x1, y1), P(x1, y0), P(x0, y0)) : quad(P(x1, y0), P(x1, y1), P(x0, y1), P(x0, y0)), uvAlong(along ? "x" : "z", 0));
    // infill above the walls under the high side
    const side = M.siding("lap"), base = Z;
    if (along) {
      for (const x of [r.x, r.x + r.w]) g.add(poly([x, base, r.y + r.d, x, base, r.y, x, H(x, r.y), r.y], side, (a, b, c) => [c, b]));
      g.add(poly(quad([r.x, base, r.y], [r.x + r.w, base, r.y], [r.x + r.w, H(r.x + r.w, r.y), r.y], [r.x, H(r.x, r.y), r.y]), side, (a, b) => [a, b]));
    } else {
      for (const y of [r.y, r.y + r.d]) g.add(poly([r.x + r.w, base, y, r.x, base, y, r.x, H(r.x, y), y], side, (a, b) => [a, b]));
      g.add(poly(quad([r.x, base, r.y], [r.x, base, r.y + r.d], [r.x, H(r.x, r.y + r.d), r.y + r.d], [r.x, H(r.x, r.y), r.y]), side, (a, b, c) => [c, b]));
    }
  } else if (r.type === "gable") {
    const side = M.siding("lap");
    if (r.ridge === "x") {
      const cy = (y0 + y1) / 2;
      add(quad(P(x0, y1), P(x1, y1), P(x1, cy), P(x0, cy)), uvAlong("x", 0));
      add(quad(P(x1, y0), P(x0, y0), P(x0, cy), P(x1, cy)), uvAlong("x", 0));
      for (const x of [r.x, r.x + r.w]) g.add(poly([x, Z, r.y + r.d, x, Z, r.y, x, H(x, cy), cy], side, (a, b, c) => [c, b]));
      g.add(box(x1 - x0, 0.6, 0.12, M.trim, (x0 + x1) / 2, ze - 0.25, y1)); g.add(box(x1 - x0, 0.6, 0.12, M.trim, (x0 + x1) / 2, ze - 0.25, y0));
    } else {
      const cx = (x0 + x1) / 2;
      add(quad(P(x1, y0), P(x1, y1), P(cx, y1), P(cx, y0)), uvAlong("z", 0));
      add(quad(P(x0, y1), P(x0, y0), P(cx, y0), P(cx, y1)), uvAlong("z", 0));
      for (const y of [r.y, r.y + r.d]) g.add(poly([r.x + r.w, Z, y, r.x, Z, y, cx, H(cx, y), y], side, (a, b) => [a, b]));
      g.add(box(0.12, 0.6, y1 - y0, M.trim, x1, ze - 0.25, (y0 + y1) / 2)); g.add(box(0.12, 0.6, y1 - y0, M.trim, x0, ze - 0.25, (y0 + y1) / 2));
    }
  } else { // hip
    const W = x1 - x0, D = y1 - y0, s = Math.min(W, D) / 2;
    if (W >= D) {
      const cy = (y0 + y1) / 2, a = x0 + s, b = x1 - s;
      add(quad(P(x0, y1), P(x1, y1), P(b, cy), P(a, cy)), uvAlong("x", 0));
      add(quad(P(x1, y0), P(x0, y0), P(a, cy), P(b, cy)), uvAlong("x", 0));
      add([...P(x0, y0), ...P(x0, y1), ...P(a, cy)], uvAlong("z", 0));
      add([...P(x1, y1), ...P(x1, y0), ...P(b, cy)], uvAlong("z", 0));
    } else {
      const cx = (x0 + x1) / 2, a = y0 + s, b = y1 - s;
      add(quad(P(x1, y0), P(x1, y1), P(cx, b), P(cx, a)), uvAlong("z", 0));
      add(quad(P(x0, y1), P(x0, y0), P(cx, a), P(cx, b)), uvAlong("z", 0));
      add([...P(x0, y1), ...P(x1, y1), ...P(cx, b)], uvAlong("x", 0));
      add([...P(x1, y0), ...P(x0, y0), ...P(cx, a)], uvAlong("x", 0));
    }
    for (const [w, d, x, y] of [[W, 0.12, (x0 + x1) / 2, y1], [W, 0.12, (x0 + x1) / 2, y0], [0.12, D, x0, (y0 + y1) / 2], [0.12, D, x1, (y0 + y1) / 2]]) g.add(box(w, 0.6, d, M.trim, x, ze - 0.25, y));
  }
  return g;
}

/* ---------- items ---------- */
function itemModel(doc, o, spec, M) {
  const lv = doc.levels[o.level] || doc.levels[0], g = new THREE.Group();
  const w = o.w || spec.w, d = o.d || spec.d, h = o.h || spec.h;
  let base = lv.elev;
  if (spec.mount === "wall") base = lv.elev + (spec.z || 1);
  if (spec.mount === "ceiling") base = lv.elev + lv.height - h;
  if (spec.mount === "ground") base = 0;
  if (spec.mount === "roof") { const ra = C.roofAt(doc, o.x, o.y); base = ra ? ra.h : lv.elev + lv.height; }
  g.position.set(o.x, base, o.y);
  g.rotation.y = -(o.rot || 0) * Math.PI / 2;
  const B = (bw, bh, bd, mat, x = 0, y = 0, z = 0) => g.add(box(bw, bh, bd, mat, x, y + bh / 2, z));
  const top0 = doc.levels[0].elev;
  switch (o.type) {
    case "fridge": B(w, h, d, M.steel); B(0.05, h * 0.9, 0.05, M.dark, w * 0.1, h * 0.05, d / 2 + 0.03); break;
    case "range": B(w, h - 0.1, d, M.steel); B(w, 0.1, d, M.black, 0, h - 0.1); B(w, 0.6, 0.2, M.steel, 0, h, -d / 2 + 0.1); break;
    case "dishwasher": B(w, h, d, M.steel); break;
    case "sink-kitchen": case "cabinets": B(w, h - 0.15, d, M.white); B(w + 0.1, 0.15, d + 0.1, M.dark, 0, h - 0.15); if (o.type === "sink-kitchen") B(0.1, 1, 0.1, M.steel, 0, h, -d / 2 + 0.3); break;
    case "island": B(w, h - 0.15, d, M.wood); B(w + 0.3, 0.15, d + 0.3, M.white, 0, h - 0.15); break;
    case "washer": case "dryer": { B(w, h, d, M.white); const door = cyl(0.7, 0.05, M.dark, 0, h * 0.55, d / 2 + 0.02); door.rotation.x = Math.PI / 2; g.add(door); break; }
    case "toilet": B(1.5, 1.4, 0.7, M.white, 0, 1.2, -0.85); g.add(cyl(0.6, 1.3, M.white, 0, 0.65, 0.25)); break;
    case "sink-bath": B(w, h, d, M.white); break;
    case "vanity": B(w, h - 0.15, d, M.wood); B(w + 0.1, 0.15, d + 0.1, M.white, 0, h - 0.15); break;
    case "tub": B(w, h, d, M.white); B(w - 0.5, 0.05, d - 0.5, M.linen, 0, h - 0.04); break;
    case "shower": B(w, 0.3, d, M.white); B(0.05, h, d, M.glass, w / 2, 0.3); B(w, h, 0.05, M.glass, 0, 0.3, d / 2); break;
    case "water-heater": g.add(cyl(0.95, h, M.white, 0, h / 2, 0)); break;
    case "furnace": B(w, h, d, M.steel); break;
    case "condenser": B(w + 0.4, 0.3, d + 0.4, M.cap); B(w, h, d, M.steel, 0, 0.3); g.add(cyl(1.1, 0.1, M.black, 0, h + 0.35, 0)); break;
    case "register": case "return": B(w, 0.04, d, M.steel); break;
    case "minisplit": B(w, h, d, M.white, 0, 0, d / 2); break;
    case "outlet": case "switch": B(w * 0.6, h, 0.06, M.white, 0, 0, d / 2); break;
    case "panel": B(w, h, 0.35, M.steel, 0, 0, d / 2); break;
    case "light": g.add(cyl(0.55, 0.35, M.white, 0, h - 0.2, 0)); break;
    case "can-light": case "smoke": g.add(cyl(0.3, 0.08, M.white, 0, h - 0.05, 0)); break;
    case "fan": g.add(cyl(0.25, 0.6, M.dark, 0, h - 0.3, 0)); for (let k = 0; k < 4; k++) { const bl = box(2, 0.04, 0.45, M.wood, 0, h - 0.6, 0); bl.position.x = Math.cos(k * Math.PI / 2) * 1.1; bl.position.z = Math.sin(k * Math.PI / 2) * 1.1; bl.rotation.y = -k * Math.PI / 2; g.add(bl); } break;
    case "bed-king": case "bed-queen": case "bed-twin": B(w, 1.1, d, M.wood); B(w - 0.2, 0.7, d - 0.3, M.linen, 0, 1.1, 0.1); B(w, 2.6, 0.25, M.wood, 0, 0, -d / 2); B(w / 2 - 0.4, 0.4, 1.2, M.linen, -w / 4, 1.8, -d / 2 + 0.9); if (w > 4) B(w / 2 - 0.4, 0.4, 1.2, M.linen, w / 4, 1.8, -d / 2 + 0.9); break;
    case "sofa": B(w, 1.4, d, M.fabric); B(w, 1.4, 0.7, M.fabric, 0, 1.4, -d / 2 + 0.35); B(0.6, 0.9, d, M.fabric, -w / 2 + 0.3, 1.4); B(0.6, 0.9, d, M.fabric, w / 2 - 0.3, 1.4); break;
    case "chair": B(w, 1.4, d, M.fabric); B(w, 1.2, 0.6, M.fabric, 0, 1.4, -d / 2 + 0.3); break;
    case "dining-table": B(w, 0.15, d, M.wood, 0, h - 0.15); for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) B(0.2, h - 0.15, 0.2, M.wood, x * (w / 2 - 0.3), 0, z * (d / 2 - 0.3)); for (const x of [-1.8, 0, 1.8]) for (const z of [-1, 1]) { B(1.3, 0.15, 1.3, M.wood, x, 1.5, z * (d / 2 + 0.7)); B(1.3, 1.6, 0.12, M.wood, x, 1.5, z * (d / 2 + 1.3)); } break;
    case "desk": B(w, 0.12, d, M.wood, 0, 2.38); B(0.15, 2.38, d, M.wood, -w / 2 + 0.1); B(0.15, 2.38, d, M.wood, w / 2 - 0.1); B(1.4, 1.5, 1.4, M.black, 0, 0, d / 2 + 0.9); break;
    case "dresser": case "bookshelf": case "tv": B(w, h, d, M.wood); if (o.type === "tv") B(w * 0.8, 2.6, 0.12, M.black, 0, h, 0); break;
    case "column": B(w, lv.height, d, M.trim); break;
    case "stairs": {
      const next = doc.levels[o.level + 1], rise = (next ? next.elev : lv.elev + lv.height + 1) - lv.elev, n = Math.max(2, Math.round(rise / (7.5 / 12)));
      for (let i = 0; i < n; i++) B(w, (rise * (i + 1)) / n, d / n, M.wood, 0, 0, d / 2 - (d / n) * (i + 0.5));
      break;
    }
    case "chimney": {
      const ra = C.roofAt(doc, o.x, o.y), topH = (ra ? ra.h : lv.elev + lv.height) + 3.5;
      g.position.y = 0;
      B(w, topH, d, M.brick); B(w + 0.4, 0.4, d + 0.4, M.concrete, 0, topH); B(0.8, 0.8, 0.8, M.dark, 0, topH + 0.4); break;
    }
    case "pipe-boot": g.add(cyl(0.3, 0.3, M.black, 0, 0.15, 0, 14, 0.45)); g.add(cyl(0.15, 1.4, M.white, 0, 0.7, 0)); break;
    case "roof-vent": B(w, 0.6, d, M.dark); break;
    case "skylight": B(w, 0.5, d, M.frame); B(w - 0.3, 0.05, d - 0.3, M.glass, 0, 0.5); break;
    case "rtu": B(w + 0.6, 1.2, d + 0.6, M.steel); B(w, h, d, M.white, 0, 1.2); g.add(cyl(1.2, 0.2, M.black, -w * 0.2, 1.2 + h + 0.1, 0)); break;
    case "exhaust-fan": B(2.5, 1, 2.5, M.steel); g.add(cyl(1.1, 1, M.steel, 0, 1.5, 0)); g.add(cyl(0.2, 0.6, M.steel, 0, 2.2, 0, 18, 1.6)); break;
    case "roof-hatch": B(w, h, d, M.steel); break;
    case "hose-bib": B(0.3, 0.3, 0.3, M.steel, 0, 0, d / 2); break;
    case "garage-slab": B(w, 0.3, d, M.concrete); break;
    case "deck": case "porch": {
      const top = o.type === "porch" ? top0 : (o.h || Math.max(top0, 2.5));
      g.position.y = 0;
      const deckTop = feetBox(w, 0.2, d, M.deck); deckTop.position.set(0, top - 0.1, 0); g.add(deckTop);
      for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 1], [0, -1]]) B(0.5, top - 0.2, 0.5, M.wood, x * (w / 2 - 0.4), 0, z * (d / 2 - 0.4));
      if (o.type === "deck") {
        for (const [rw, rd, x, z] of [[w, 0.15, 0, d / 2 - 0.1], [0.15, d, -w / 2 + 0.1, 0], [0.15, d, w / 2 - 0.1, 0]]) { B(rw, 0.2, rd, M.wood, x, top + 3, z); for (let k = 0; k <= Math.max(rw, rd) / 0.5; k++) B(0.08, 3, 0.08, M.white, rw > rd ? -rw / 2 + k * 0.5 : x, top, rw > rd ? z : -rd / 2 + k * 0.5); }
        // steps down to the yard
        for (let k = 0; k < Math.ceil(top / 0.6); k++) B(4, top - k * 0.6, 1, M.wood, 0, 0, d / 2 + 0.5 + k);
      } else {
        const ph = doc.levels[0].height + top0 - 0.6;
        for (const x of [-1, 1]) B(0.6, ph - top, 0.6, M.trim, x * (w / 2 - 0.6), top, d / 2 - 0.6);
        const rf = box(w + 1, 0.3, d + 1, M.roof, 0, ph + 0.4, 0.3); rf.rotation.x = -0.12; g.add(rf);
        B(w + 0.6, 0.7, 0.3, M.trim, 0, ph - 0.3, d / 2 - 0.4);
        for (let k = 0; k < Math.ceil(top / 0.6); k++) B(5, top - k * 0.6, 1, M.concrete, 0, 0, d / 2 + 0.5 + k);
      }
      break;
    }
    default: B(w, h, d, M.cap);
  }
  // wall-mounted items sit against the wall behind them (their -z side)
  if (spec.mount === "wall") g.children.forEach((c) => (c.position.z -= d / 2));
  return g;
}

/* ---------- viewer: orbit + walk-through ---------- */
export function createViewer(canvas, { hd = true, mobile = false } = {}) {
  const stage = createStage(canvas, { mobile, hd, dpr: mobile ? 1.5 : 1.5 });
  const { scene, camera, sun } = stage;
  camera.near = 0.3; camera.far = 4000; camera.updateProjectionMatrix();
  const sc = sun.shadow.camera; sc.left = -120; sc.right = 120; sc.top = 120; sc.bottom = -120; sc.far = 600; sc.updateProjectionMatrix();
  stage.setSun(45, -60, "day");
  stage.usePhotoSky().then(() => api.request()).catch(() => {});
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshStandardMaterial({ map: TX.photo("lawn", { repeat: 140 }), color: "#88ad62", roughness: 1 }));
  lawn.rotation.x = -Math.PI / 2; lawn.position.y = -0.02; lawn.receiveShadow = true; scene.add(lawn);
  const orbit = new OrbitControls(camera, canvas);
  orbit.enableDamping = true; orbit.maxPolarAngle = Math.PI * 0.495; orbit.minDistance = 5; orbit.maxDistance = 700;
  const walk = new PointerLockControls(camera, canvas);
  let model = null, doc = null, mode = "orbit", queued = false, xray = false;
  const keys = {}, player = { level: 0, feet: 0 };
  // indoors there's no sun on the ceilings: an even fill light while walking
  const indoor = new THREE.HemisphereLight("#ffffff", "#c9c2b6", 1.6);
  indoor.visible = false; scene.add(indoor);
  orbit.addEventListener("change", () => api.request());

  function frame(now) {
    queued = false;
    if (mode === "walk") { step(now); api.request(); }
    else if (orbit.update()) api.request();
    stage.render();
  }
  /* walk-through: WASD + mouse look, eye at 5'6", collide with walls, stairs carry you between floors */
  let last = 0;
  const solids = () => {
    const out = [], rl = C.rooms(doc, player.level);
    for (const w of C.wallsOn(doc, player.level)) {
      const [a, b] = C.ends(doc, w), L = C.dist(a, b), ux = (b.x - a.x) / L, uy = (b.y - a.y) / L;
      const gaps = doc.openings.filter((o) => o.wall === w.id && o.type !== "window" && o.sill < 1).map((o) => [o.t, o.t + o.w]).sort((m, n) => m[0] - n[0]);
      let s = 0;
      for (const [g0, g1] of [...gaps, [L, L]]) { if (g0 - s > 0.05) out.push({ a: { x: a.x + ux * s, y: a.y + uy * s }, b: { x: a.x + ux * g0, y: a.y + uy * g0 }, t: C.thick(w) }); s = g1; }
    }
    void rl;
    return out;
  };
  function stairsAt(x, y) {
    for (const st of doc.objects) {
      if (st.type !== "stairs") continue;
      const ang = (st.rot || 0) * Math.PI / 2, dx = x - st.x, dy = y - st.y;
      const lx = dx * Math.cos(-ang) - dy * Math.sin(-ang), ly = dx * Math.sin(-ang) + dy * Math.cos(-ang), w = st.w || ITEMS.stairs.w, d = st.d || ITEMS.stairs.d;
      if (Math.abs(lx) <= w / 2 + 0.3 && ly >= -d / 2 - 0.6 && ly <= d / 2 + 0.6) {
        const k = Math.min(1, Math.max(0, (d / 2 - ly) / d)), lo = doc.levels[st.level], hi = doc.levels[st.level + 1];
        if (!hi) return null;
        return { st, k, feet: lo.elev + k * (hi.elev - lo.elev), lo: st.level, hi: st.level + 1 };
      }
    }
    return null;
  }
  function groundAt(x, y) {
    const s = stairsAt(x, y);
    if (s && (s.lo === player.level || s.hi === player.level)) { player.level = s.k > 0.6 ? s.hi : s.lo; return s.feet; }
    const lv = doc.levels[player.level];
    if (C.rooms(doc, player.level).some((r) => C.inside({ x, y }, r.pts))) return lv.elev;
    for (const o of doc.objects) if ((o.type === "deck" || o.type === "porch") && Math.abs(x - o.x) <= (o.w || 10) / 2 && Math.abs(y - o.y) <= (o.d || 6) / 2) return o.type === "porch" ? doc.levels[0].elev : (o.h || Math.max(doc.levels[0].elev, 2.5));
    return player.level === 0 ? 0 : null; // upstairs, you can't walk off into the air
  }
  function step(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
    if (!walk.isLocked) return;
    const speed = (keys.ShiftLeft || keys.ShiftRight ? 14 : 7) * dt;
    const f = new THREE.Vector3(); camera.getWorldDirection(f); f.y = 0; f.normalize();
    const r = new THREE.Vector3(-f.z, 0, f.x);
    const mv = new THREE.Vector3();
    if (keys.KeyW || keys.ArrowUp) mv.add(f); if (keys.KeyS || keys.ArrowDown) mv.sub(f);
    if (keys.KeyD || keys.ArrowRight) mv.add(r); if (keys.KeyA || keys.ArrowLeft) mv.sub(r);
    if (!mv.lengthSq()) return;
    mv.normalize().multiplyScalar(speed);
    let p = { x: camera.position.x + mv.x, y: camera.position.z + mv.z };
    for (const s of solids()) {
      const q = C.project(p, s.a, s.b), d = C.dist(p, q), min = s.t / 2 + 0.9;
      if (d < min && d > 1e-4) { p = { x: q.x + ((p.x - q.x) / d) * min, y: q.y + ((p.y - q.y) / d) * min }; }
    }
    const gnd = groundAt(p.x, p.y);
    if (gnd == null) return;
    player.feet = gnd;
    camera.position.set(p.x, gnd + 5.5, p.y);
  }
  addEventListener("keydown", (e) => { if (mode === "walk") { keys[e.code] = true; if (/Arrow/.test(e.code)) e.preventDefault(); } });
  addEventListener("keyup", (e) => { keys[e.code] = false; });

  const api = {
    stage, camera, scene,
    get mode() { return mode; },
    request() { if (!queued) { queued = true; requestAnimationFrame(frame); } },
    resize() { stage.resize(); api.request(); },
    setDoc(d, opt = {}) {
      doc = d;
      if (model) { scene.remove(model); model.traverse((m) => { m.geometry?.dispose(); }); }
      xray = !!opt.systems;
      model = buildModel(d, { ...opt, walk: mode === "walk", ceilings: mode === "walk" });
      if (xray) model.traverse((m) => { if (m.isMesh && m.userData.pick?.kind === "wall") { m.material = (Array.isArray(m.material) ? m.material : [m.material]).map((x) => { const c = x.clone(); c.transparent = true; c.opacity = 0.22; c.depthWrite = false; return c; }); } });
      scene.add(model);
      api.request();
    },
    frameAll(view = "front") {
      const b = new THREE.Box3().setFromObject(model || new THREE.Object3D());
      if (b.isEmpty()) b.set(V(-20, 0, -20), V(20, 10, 20));
      const c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3()), R2 = Math.max(s.x, s.z, 20);
      const dirs = { front: V(-0.55, 0.45, 1), back: V(0.55, 0.45, -1), top: V(0, 1, 0.01), left: V(-1, 0.4, 0.3), right: V(1, 0.4, 0.3) };
      camera.position.copy(c).add(dirs[view].normalize().multiplyScalar(R2 * 2.3 + 20));
      orbit.target.copy(c); orbit.update(); api.request();
    },
    walkMode(on, start) {
      if (on) {
        mode = "walk"; orbit.enabled = false; indoor.visible = true;
        player.level = start?.level ?? 0;
        const lv = doc.levels[player.level];
        camera.position.set(start?.x ?? 0, lv.elev + 5.5, start?.y ?? 0);
        camera.lookAt(camera.position.x, camera.position.y, camera.position.z - 10);
        api.setDoc(doc, { layers: api.layers });
        walk.lock();
      } else {
        mode = "orbit"; orbit.enabled = true; indoor.visible = false; walk.unlock();
        api.setDoc(doc, { layers: api.layers }); api.frameAll();
      }
    },
    onUnlock(fn) { walk.addEventListener("unlock", fn); },
    lock() { walk.lock(); },
    layers: {},
    // pick what's under a click (for selecting in 3D)
    pick(ev) {
      const r = canvas.getBoundingClientRect(), ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1), camera);
      const hit = model && ray.intersectObject(model, true).find((h) => h.object.userData.pick);
      return hit?.object.userData.pick || null;
    },
    snapshot: (w) => stage.snapshot(w),
  };
  new ResizeObserver(() => api.resize()).observe(canvas);
  return api;
}

/* ---------- line drawings for the print set (elevations, roof plan) ---------- */
let printRenderer = null;
export function lineDrawing(doc, view, width = 1400, height = 700) {
  const model = buildModel(doc, { layers: { furniture: false, plumbing: false, hvac: false, electrical: false } });
  model.updateMatrixWorld(true);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#ffffff");
  const fill = new THREE.MeshBasicMaterial({ color: "#ffffff", polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, side: THREE.DoubleSide });
  const glass = new THREE.MeshBasicMaterial({ color: "#dfe6ee", polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const ink = new THREE.LineBasicMaterial({ color: "#111111" });
  model.traverse((m) => {
    if (!m.isMesh) return;
    const isGlass = [].concat(m.material).some((x) => x.transparent);
    const solid = new THREE.Mesh(m.geometry, isGlass ? glass : fill);
    solid.matrixAutoUpdate = false; solid.matrix.copy(m.matrixWorld);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 30), ink);
    edges.matrixAutoUpdate = false; edges.matrix.copy(m.matrixWorld);
    scene.add(solid, edges);
  });
  const b = new THREE.Box3().setFromObject(model), c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3());
  // grade line
  const gl = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(b.min.x - 20, 0, c.z), V(b.max.x + 20, 0, c.z)]), new THREE.LineBasicMaterial({ color: "#111" }));
  const gl2 = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(c.x, 0, b.min.z - 20), V(c.x, 0, b.max.z + 20)]), new THREE.LineBasicMaterial({ color: "#111" }));
  if (view === "front" || view === "back") scene.add(gl); else if (view !== "top") scene.add(gl2);
  const aspect = width / height;
  let spanW, spanH;
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 5000);
  const far = 1000;
  if (view === "top") { cam.position.set(c.x, b.max.y + far, c.z); cam.up.set(0, 0, -1); spanW = s.x; spanH = s.z; }
  else if (view === "front") { cam.position.set(c.x, c.y, b.max.z + far); spanW = s.x; spanH = s.y; }
  else if (view === "back") { cam.position.set(c.x, c.y, b.min.z - far); spanW = s.x; spanH = s.y; }
  else if (view === "left") { cam.position.set(b.min.x - far, c.y, c.z); spanW = s.z; spanH = s.y; }
  else { cam.position.set(b.max.x + far, c.y, c.z); spanW = s.z; spanH = s.y; }
  cam.lookAt(c);
  const k = 1.06, halfH = Math.max(spanH, spanW / aspect) * k / 2, halfW = halfH * aspect;
  Object.assign(cam, { left: -halfW, right: halfW, top: halfH, bottom: -halfH });
  cam.updateProjectionMatrix();
  if (!printRenderer) printRenderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  printRenderer.setPixelRatio(1);
  printRenderer.setSize(width, height, false);
  printRenderer.render(scene, cam);
  // thicken the 1-px WebGL lines so they print dark: multiply the image over itself, offset by a pixel
  const out = document.createElement("canvas"); out.width = width; out.height = height;
  const g = out.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, width, height);
  g.globalCompositeOperation = "multiply";
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) g.drawImage(printRenderer.domElement, dx, dy);
  const url = out.toDataURL("image/png");
  scene.traverse((m) => { if (m.isLineSegments) m.geometry.dispose(); });
  // feet per pixel on the drawing, for the scale bar
  return { url, ftPerPx: (halfW * 2) / width };
}
