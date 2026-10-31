/* Building designer: the document model. Everything (plan, 3D, walk-through, prints, takeoff)
   is derived from one JSON document, so the views never disagree.
   Units are feet. Plan coordinates: x to the right, y down the page (y = +z in 3D, the street side). */
import { ASSEMBLIES, ITEMS, OPENINGS } from "./catalog.js";

export const EPS = 1e-6;
let counter = Date.now() % 1e6;
export const uid = (p) => `${p}${(counter++).toString(36)}`;
export const clone = (o) => JSON.parse(JSON.stringify(o));
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const r2 = (v) => Math.round(v * 100) / 100;

/* ---------- a new document ---------- */
export function blank(kind = "home") {
  return {
    v: 1, name: "Untitled design", kind,
    levels: [{ id: uid("L"), name: "First floor", elev: kind === "home" ? 1 : 0.5, height: kind === "home" ? 9 : 14 }],
    nodes: {}, walls: [], openings: [], objects: [], runs: [], roofs: [], rooms: {},
    settings: { siding: "lap", sidingColor: "#c9c6bd", trimColor: "#f4f3ef", roofMaterial: "shingle", roofColor: "#3c3e42", brickColor: "#8a4a3a" },
  };
}

/* ---------- geometry ---------- */
export function area(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p.x * q.y - q.x * p.y; }
  return a / 2;
}
export function centroid(pts) {
  let cx = 0, cy = 0, a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length], f = p.x * q.y - q.x * p.y;
    cx += (p.x + q.x) * f; cy += (p.y + q.y) * f; a += f;
  }
  if (Math.abs(a) < EPS) return { x: pts[0].x, y: pts[0].y };
  return { x: cx / (3 * a), y: cy / (3 * a) };
}
export function inside(p, pts) {
  let hit = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}
// closest point on segment ab to p, with t in [0, 1]
export function project(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy || EPS;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2));
  return { x: a.x + dx * t, y: a.y + dy * t, t };
}
function cross(a, b, c, d) { // proper intersection of segments ab and cd
  const den = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
  if (Math.abs(den) < EPS) return null;
  const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / den;
  const u = ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / den;
  if (t <= 0.001 || t >= 0.999 || u <= 0.001 || u >= 0.999) return null;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, t };
}

/* ---------- walls ---------- */
export const wallsOn = (doc, L) => doc.walls.filter((w) => w.level === L);
export const ends = (doc, w) => [doc.nodes[w.a], doc.nodes[w.b]];
export const wallLength = (doc, w) => dist(doc.nodes[w.a], doc.nodes[w.b]);
export const thick = (w) => ASSEMBLIES[w.asm]?.thick ?? 0.5;
export const levelOf = (doc, L) => doc.levels[L];

function nodeAt(doc, L, p, tol = 0.05) {
  for (const [id, n] of Object.entries(doc.nodes)) if (n.level === L && Math.abs(n.x - p.x) < tol && Math.abs(n.y - p.y) < tol) return id;
  return null;
}
export function getNode(doc, L, p) {
  const found = nodeAt(doc, L, p);
  if (found) return found;
  // landing on the middle of a wall splits it, so junctions are real nodes (rooms need that)
  for (const w of wallsOn(doc, L)) {
    const [a, b] = ends(doc, w), q = project(p, a, b);
    if (q.t > 0.001 && q.t < 0.999 && dist(q, p) < 0.05) return splitWall(doc, w, q);
  }
  const id = uid("n");
  doc.nodes[id] = { x: r2(p.x), y: r2(p.y), level: L };
  return id;
}
export function splitWall(doc, w, p) {
  const [a, b] = ends(doc, w), L1 = dist(a, p);
  const id = uid("n");
  doc.nodes[id] = { x: r2(p.x), y: r2(p.y), level: w.level };
  const nw = { ...clone(w), id: uid("w"), a: id, b: w.b };
  w.b = id;
  doc.walls.push(nw);
  for (const o of doc.openings) if (o.wall === w.id && o.t >= L1 - 0.01) { o.wall = nw.id; o.t = r2(o.t - L1); }
  return id;
}
// add a wall between two points, splitting at every crossing so the wall graph stays planar
export function addWall(doc, L, p1, p2, asm) {
  if (dist(p1, p2) < 0.25) return [];
  const hits = [];
  for (const w of wallsOn(doc, L)) {
    const [a, b] = ends(doc, w), x = cross(p1, p2, a, b);
    if (x) hits.push({ ...x, w });
  }
  hits.sort((m, n) => m.t - n.t);
  const pts = [p1];
  for (const h of hits) { splitWall(doc, h.w, h); pts.push(h); }
  pts.push(p2);
  const made = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = getNode(doc, L, pts[i]), b = getNode(doc, L, pts[i + 1]);
    if (a === b || doc.walls.some((w) => (w.a === a && w.b === b) || (w.a === b && w.b === a))) continue;
    const w = { id: uid("w"), level: L, a, b, asm };
    doc.walls.push(w);
    made.push(w);
  }
  return made;
}
export function deleteWall(doc, w) {
  doc.walls = doc.walls.filter((x) => x !== w);
  doc.openings = doc.openings.filter((o) => o.wall !== w.id);
  prune(doc);
}
export function prune(doc) {
  const used = new Set(doc.walls.flatMap((w) => [w.a, w.b]));
  for (const id of Object.keys(doc.nodes)) if (!used.has(id)) delete doc.nodes[id];
}
export function rectWalls(doc, L, x0, y0, x1, y1, asm) {
  const [a, b, c, d] = [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
  return [...addWall(doc, L, a, b, asm), ...addWall(doc, L, b, c, asm), ...addWall(doc, L, c, d, asm), ...addWall(doc, L, d, a, asm)];
}

/* ---------- rooms: the faces of the wall graph ---------- */
export function rooms(doc, L) {
  const walls = wallsOn(doc, L);
  const out = {}; // node → outgoing half-edges sorted by angle
  for (const w of walls) for (const [s, t] of [[w.a, w.b], [w.b, w.a]]) {
    const ps = doc.nodes[s], pt = doc.nodes[t];
    (out[s] ||= []).push({ s, t, ang: Math.atan2(pt.y - ps.y, pt.x - ps.x) });
  }
  Object.values(out).forEach((l) => l.sort((m, n) => m.ang - n.ang));
  const used = new Set(), faces = [];
  for (const list of Object.values(out)) for (const he of list) {
    const key0 = he.s + ">" + he.t;
    if (used.has(key0)) continue;
    const cyc = []; let e = he, guard = 0;
    while (e && !used.has(e.s + ">" + e.t) && guard++ < 500) {
      used.add(e.s + ">" + e.t);
      cyc.push(e.s);
      // at the far node, take the next edge clockwise from the way we came in
      const back = Math.atan2(doc.nodes[e.s].y - doc.nodes[e.t].y, doc.nodes[e.s].x - doc.nodes[e.t].x);
      const cand = out[e.t];
      if (!cand) break;
      let best = null, bestA = Infinity;
      for (const c of cand) {
        if (c.t === e.s && cand.length > 1) continue;
        let a = back - c.ang; while (a <= 0) a += Math.PI * 2;
        if (a < bestA) { bestA = a; best = c; }
      }
      e = best;
    }
    if (e && e.s === he.s && cyc.length >= 3) {
      const pts = cyc.map((id) => doc.nodes[id]);
      const A = area(pts);
      if (A > 1) faces.push({ nodes: cyc, pts, area: A, key: [...cyc].sort().join("|") });
    }
  }
  return faces.map((f) => {
    const meta = doc.rooms[f.key] || {};
    return { ...f, c: centroid(f.pts), name: meta.name || "", floor: meta.floor || defaultFloor(doc) };
  });
}
export const defaultFloor = (doc) => (doc.kind === "commercial" ? "concrete" : "wood");

// which side of a wall faces the outdoors: +1 = left of a→b, -1 = right, 0 = both inside (interior wall)
export function outsideSide(doc, w, roomList) {
  const [a, b] = ends(doc, w), L = dist(a, b) || 1;
  const nx = -(b.y - a.y) / L, ny = (b.x - a.x) / L, m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, o = thick(w) / 2 + 0.3;
  const left = roomList.some((r) => inside({ x: m.x + nx * o, y: m.y + ny * o }, r.pts));
  const right = roomList.some((r) => inside({ x: m.x - nx * o, y: m.y - ny * o }, r.pts));
  if (left && right) return 0;
  if (!left && !right) return 2; // free-standing
  return left ? -1 : 1;
}

export function bounds(doc, L) {
  const ns = Object.values(doc.nodes).filter((n) => L == null || n.level === L);
  if (!ns.length) return null;
  const xs = ns.map((n) => n.x), ys = ns.map((n) => n.y);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}
export const topLevel = (doc) => {
  for (let i = doc.levels.length - 1; i >= 0; i--) if (wallsOn(doc, i).length) return i;
  return 0;
};
// a roof over the top floor's footprint
export function autoRoof(doc) {
  const L = topLevel(doc), b = bounds(doc, L);
  if (!b) return null;
  doc.roofs = doc.roofs.filter((r) => r.level !== L);
  const r = { id: uid("r"), level: L, x: b.x0, y: b.y0, w: b.x1 - b.x0, d: b.y1 - b.y0, type: doc.kind === "commercial" ? "flat" : "gable", pitch: 7, overhang: doc.kind === "commercial" ? 0 : 1.5, ridge: b.x1 - b.x0 >= b.y1 - b.y0 ? "x" : "y", parapet: doc.kind === "commercial" ? 3 : 0 };
  doc.roofs.push(r);
  return r;
}

/* ---------- roofs: height of the roof surface at a plan point ---------- */
export function roofBase(doc, r) { const lv = doc.levels[r.level]; return lv.elev + lv.height; }
export function roofHeightAt(doc, r, x, y) {
  const p = r.pitch / 12, z = roofBase(doc, r), o = r.overhang;
  const x0 = r.x - o, y0 = r.y - o, x1 = r.x + r.w + o, y1 = r.y + r.d + o;
  if (x < x0 || x > x1 || y < y0 || y > y1) return null;
  const toEave = { x: Math.min(x - x0, x1 - x), y: Math.min(y - y0, y1 - y) };
  if (r.type === "flat") return z + 0.6;
  if (r.type === "shed") return z - o * p + (r.ridge === "x" ? (y1 - y) : (x1 - x)) * p;
  if (r.type === "gable") return z - o * p + (r.ridge === "x" ? toEave.y : toEave.x) * p;
  return z - o * p + Math.min(toEave.x, toEave.y) * p; // hip
}
export function roofAt(doc, x, y) {
  let best = null;
  for (const r of doc.roofs) { const h = roofHeightAt(doc, r, x, y); if (h != null && (best == null || h > best.h)) best = { r, h }; }
  return best;
}
export function roofStats(r) {
  const o = r.overhang, W = r.w + 2 * o, D = r.d + 2 * o, p = r.pitch / 12, f = Math.sqrt(1 + p * p);
  const plan = W * D;
  if (r.type === "flat") return { plan, sloped: plan, eaves: 2 * (W + D), ridge: 0, hips: 0, rakes: 0 };
  if (r.type === "shed") return { plan, sloped: plan * f, eaves: r.ridge === "x" ? W : D, ridge: r.ridge === "x" ? W : D, hips: 0, rakes: 2 * (r.ridge === "x" ? D : W) * f };
  if (r.type === "gable") { const len = r.ridge === "x" ? W : D, run = (r.ridge === "x" ? D : W) / 2; return { plan, sloped: plan * f, eaves: 2 * len, ridge: len, hips: 0, rakes: 4 * run * f }; }
  const s = Math.min(W, D) / 2, ridge = Math.abs(W - D), hip = Math.sqrt(2 * s * s + (s * p) ** 2);
  return { plan, sloped: plan * f, eaves: 2 * (W + D), ridge, hips: 4 * hip, rakes: 0 };
}

/* ---------- openings ---------- */
export function openingPos(doc, o) {
  const w = doc.walls.find((x) => x.id === o.wall);
  if (!w) return null;
  const [a, b] = ends(doc, w), L = dist(a, b), ux = (b.x - a.x) / L, uy = (b.y - a.y) / L;
  return { w, a, b, L, ux, uy, x: a.x + ux * (o.t + o.w / 2), y: a.y + uy * (o.t + o.w / 2) };
}
export function clampOpening(doc, o) {
  const w = doc.walls.find((x) => x.id === o.wall);
  if (!w) return;
  const L = wallLength(doc, w);
  o.w = Math.min(o.w, L - 0.5);
  o.t = r2(Math.max(0.25, Math.min(L - o.w - 0.25, o.t)));
}

/* ---------- history ---------- */
export function history(doc, onChange) {
  const past = [], future = [];
  let last = JSON.stringify(doc);
  return {
    commit() {
      const now = JSON.stringify(doc);
      if (now === last) return;
      past.push(last); if (past.length > 120) past.shift();
      future.length = 0; last = now; onChange();
    },
    undo() { if (!past.length) return; future.push(last); last = past.pop(); Object.assign(doc, JSON.parse(last)); onChange(true); },
    redo() { if (!future.length) return; past.push(last); last = future.pop(); Object.assign(doc, JSON.parse(last)); onChange(true); },
    reset() { past.length = future.length = 0; last = JSON.stringify(doc); },
    get canUndo() { return past.length > 0; }, get canRedo() { return future.length > 0; },
  };
}

/* ---------- templates ---------- */
function opening(doc, wall, type, style, t, w, h, sill) { const o = { id: uid("o"), wall: wall.id, type, style, t, w, h, sill, swing: 1, hinge: 0 }; doc.openings.push(o); return o; }
function item(doc, L, type, x, y, rot = 0, extra = {}) { const it = { id: uid("i"), type, level: L, x, y, rot, ...extra }; doc.objects.push(it); return it; }
function wallBetween(doc, L, p, q) { // the wall whose ends match two points
  const a = nodeAt(doc, L, p), b = nodeAt(doc, L, q);
  return doc.walls.find((w) => (w.a === a && w.b === b) || (w.a === b && w.b === a));
}
function label(doc, L, x, y, name, floor) {
  const r = rooms(doc, L).find((f) => inside({ x, y }, f.pts));
  if (r) doc.rooms[r.key] = { name, floor };
}

export const TEMPLATES = {
  blank: { name: "Blank home", make: () => blank("home") },
  ranch: {
    name: "Ranch home · 3 bed",
    make() {
      const d = blank("home"); d.name = "Ranch home";
      const E = "ext-2x6-vinyl", I = "int-2x4";
      rectWalls(d, 0, 0, 0, 48, 30, E);
      addWall(d, 0, { x: 30, y: 0 }, { x: 30, y: 30 }, I);       // living | bedrooms
      addWall(d, 0, { x: 30, y: 14 }, { x: 48, y: 14 }, I);
      addWall(d, 0, { x: 39, y: 14 }, { x: 39, y: 30 }, I);
      addWall(d, 0, { x: 30, y: 8 }, { x: 38, y: 8 }, I);        // bath
      addWall(d, 0, { x: 38, y: 0 }, { x: 38, y: 8 }, I);
      addWall(d, 0, { x: 38, y: 8 }, { x: 38, y: 14 }, I);       // hall | primary
      const front = wallBetween(d, 0, { x: 0, y: 30 }, { x: 30, y: 30 });
      opening(d, front, "door", "entry", 12, 3, 6.67, 0);
      opening(d, front, "window", "double-hung", 3, 6, 4.5, 2.5);
      opening(d, front, "window", "double-hung", 20, 6, 4.5, 2.5);
      const fr = wallBetween(d, 0, { x: 39, y: 30 }, { x: 48, y: 30 }); opening(d, fr, "window", "double-hung", 2.5, 4, 4.5, 2.5);
      const fr2 = wallBetween(d, 0, { x: 30, y: 30 }, { x: 39, y: 30 }); opening(d, fr2, "window", "double-hung", 2.5, 4, 4.5, 2.5);
      const back = wallBetween(d, 0, { x: 0, y: 0 }, { x: 30, y: 0 }); opening(d, back, "window", "slider", 4, 5, 3.5, 3.5); opening(d, back, "door", "patio", 18, 6, 6.67, 0);
      const bk2 = wallBetween(d, 0, { x: 38, y: 0 }, { x: 48, y: 0 }); opening(d, bk2, "window", "double-hung", 3, 4, 4.5, 2.5);
      const side = wallBetween(d, 0, { x: 48, y: 14 }, { x: 48, y: 30 }); opening(d, side, "window", "double-hung", 6, 4, 4.5, 2.5);
      for (const [p, q, t] of [[{ x: 30, y: 14 }, { x: 30, y: 30 }, 2], [{ x: 30, y: 8 }, { x: 30, y: 14 }, 1.5], [{ x: 39, y: 14 }, { x: 39, y: 30 }, 1]]) {
        const w = wallBetween(d, 0, p, q); if (w) opening(d, w, "door", "interior", t, 2.67, 6.67, 0);
      }
      const bw = wallBetween(d, 0, { x: 38, y: 8 }, { x: 30, y: 8 }); if (bw) opening(d, bw, "door", "interior", 2, 2.5, 6.67, 0);
      const pw = wallBetween(d, 0, { x: 38, y: 8 }, { x: 38, y: 14 }); if (pw) opening(d, pw, "door", "interior", 1.5, 2.67, 6.67, 0);
      label(d, 0, 15, 22, "Living · kitchen · dining", "wood");
      label(d, 0, 34, 4, "Bath", "tile"); label(d, 0, 43, 7, "Primary bed", "carpet"); label(d, 0, 34, 22, "Bedroom 2", "carpet"); label(d, 0, 44, 22, "Bedroom 3", "carpet"); label(d, 0, 34, 11, "Hall", "wood");
      item(d, 0, "fridge", 1.6, 1.4); item(d, 0, "range", 6, 1.3); item(d, 0, "sink-kitchen", 10, 1.3); item(d, 0, "dishwasher", 12.5, 1.3);
      item(d, 0, "island", 7, 7.5); item(d, 0, "dining-table", 22, 6); item(d, 0, "sofa", 15, 27.5, 2); item(d, 0, "tv", 15, 14.6);
      item(d, 0, "toilet", 31.5, 1.4); item(d, 0, "vanity", 34.5, 1.2); item(d, 0, "tub", 36.6, 4.5, 1);
      item(d, 0, "bed-king", 43, 3.8); item(d, 0, "bed-queen", 34.5, 26.4, 2); item(d, 0, "bed-queen", 43.5, 26.4, 2);
      item(d, 0, "outlet", 0.3, 20, 3); item(d, 0, "outlet", 20, 29.7, 2); item(d, 0, "switch", 15.3, 29.7, 2); item(d, 0, "light", 15, 21); item(d, 0, "light", 7, 6); item(d, 0, "light", 43, 7);
      item(d, 0, "panel", 47.6, 10, 1); item(d, 0, "furnace", 36, 12); item(d, 0, "water-heater", 37.2, 9.5);
      item(d, 0, "register", 15, 29.4, 2); item(d, 0, "register", 43, 0.6); item(d, 0, "condenser", 51, 12, 0, { outside: true });
      item(d, 0, "chimney", 2, 20); item(d, 0, "pipe-boot", 33, 3); item(d, 0, "roof-vent", 20, 8); item(d, 0, "roof-vent", 40, 8);
      d.objects.push({ id: uid("i"), type: "deck", level: 0, x: 9, y: -6.5, rot: 0, w: 18, d: 12 });
      d.objects.push({ id: uid("i"), type: "porch", level: 0, x: 13.5, y: 33, rot: 0, w: 9, d: 6 });
      d.runs.push({ id: uid("p"), level: 0, system: "supply", pts: [[37, 9.5], [37, 1.5], [33, 1.5], [10, 1.5]] });
      d.runs.push({ id: uid("p"), level: 0, system: "duct", pts: [[36, 12], [15, 12], [15, 28]] });
      d.runs.push({ id: uid("p"), level: 0, system: "wire", pts: [[47.6, 10], [47.6, 20], [43, 20], [43, 7]] });
      autoRoof(d);
      return d;
    },
  },
  twostory: {
    name: "Two-story home",
    make() {
      const d = blank("home"); d.name = "Two-story home";
      d.levels.push({ id: uid("L"), name: "Second floor", elev: 10.25, height: 8.5 });
      const E = "ext-2x6-lp", I = "int-2x4";
      rectWalls(d, 0, 0, 0, 36, 28, E); rectWalls(d, 1, 0, 0, 36, 28, E);
      addWall(d, 0, { x: 18, y: 0 }, { x: 18, y: 28 }, I);
      addWall(d, 1, { x: 18, y: 0 }, { x: 18, y: 28 }, I); addWall(d, 1, { x: 0, y: 14 }, { x: 18, y: 14 }, I); addWall(d, 1, { x: 18, y: 12 }, { x: 36, y: 12 }, I);
      const f = wallBetween(d, 0, { x: 0, y: 28 }, { x: 18, y: 28 }); opening(d, f, "door", "entry", 7, 3, 6.67, 0); opening(d, f, "window", "picture", 1.5, 4, 5, 2);
      const f2 = wallBetween(d, 0, { x: 18, y: 28 }, { x: 36, y: 28 }); opening(d, f2, "window", "double-hung", 3, 5, 5, 2); opening(d, f2, "window", "double-hung", 11, 5, 5, 2);
      for (const [p, q] of [[{ x: 0, y: 28 }, { x: 18, y: 28 }], [{ x: 18, y: 28 }, { x: 36, y: 28 }]]) { const w = wallBetween(d, 1, p, q); if (w) { opening(d, w, "window", "double-hung", 3, 3.5, 4.5, 2.5); opening(d, w, "window", "double-hung", 11, 3.5, 4.5, 2.5); } }
      const mid = wallBetween(d, 0, { x: 18, y: 0 }, { x: 18, y: 28 }); opening(d, mid, "opening", "cased", 16, 6, 7, 0);
      label(d, 0, 9, 14, "Living", "wood"); label(d, 0, 27, 14, "Kitchen & dining", "tile");
      label(d, 1, 9, 7, "Bedroom 2", "carpet"); label(d, 1, 9, 21, "Bedroom 3", "carpet"); label(d, 1, 27, 6, "Bath", "tile"); label(d, 1, 27, 20, "Primary bed", "carpet");
      for (const [L, p, q, t] of [[1, { x: 18, y: 14 }, { x: 18, y: 0 }, 5], [1, { x: 18, y: 14 }, { x: 18, y: 28 }, 6], [1, { x: 18, y: 12 }, { x: 18, y: 0 }, 2]]) { const w = wallBetween(d, L, p, q); if (w) opening(d, w, "door", "interior", t, 2.67, 6.67, 0); }
      item(d, 0, "stairs", 2.5, 4.5, 0); item(d, 0, "sofa", 9, 25.5, 2); item(d, 0, "fridge", 34.4, 1.4); item(d, 0, "range", 29, 1.3); item(d, 0, "sink-kitchen", 24, 1.3); item(d, 0, "dining-table", 27, 18);
      item(d, 1, "bed-king", 27, 25, 2); item(d, 1, "bed-queen", 9, 3.8); item(d, 1, "bed-queen", 9, 24.2, 2); item(d, 1, "toilet", 33, 1.4); item(d, 1, "tub", 23, 3.2, 0); item(d, 1, "vanity", 29, 1.2);
      item(d, 0, "chimney", 35, 20); item(d, 1, "pipe-boot", 31, 3);
      d.objects.push({ id: uid("i"), type: "porch", level: 0, x: 8.5, y: 31, rot: 0, w: 14, d: 6 });
      autoRoof(d); d.roofs[0].type = "hip";
      return d;
    },
  },
  commercial: {
    name: "Commercial · retail box",
    make() {
      const d = blank("commercial"); d.name = "Retail building";
      d.settings.roofMaterial = "tpo";
      const E = "ext-cmu", I = "int-steel";
      rectWalls(d, 0, 0, 0, 80, 44, E);
      const front = wallBetween(d, 0, { x: 80, y: 44 }, { x: 0, y: 44 });
      if (front) front.asm = "ext-storefront";
      addWall(d, 0, { x: 56, y: 0 }, { x: 56, y: 44 }, I); addWall(d, 0, { x: 56, y: 22 }, { x: 80, y: 22 }, I); addWall(d, 0, { x: 68, y: 22 }, { x: 68, y: 44 }, I);
      const sf = wallBetween(d, 0, { x: 0, y: 44 }, { x: 56, y: 44 });
      if (sf) { sf.asm = "ext-storefront"; opening(d, sf, "door", "storefront", 25, 6, 7, 0); opening(d, sf, "window", "storefront", 3, 20, 9, 1); opening(d, sf, "window", "storefront", 33, 20, 9, 1); }
      const back = wallBetween(d, 0, { x: 56, y: 0 }, { x: 80, y: 0 });
      if (back) opening(d, back, "door", "overhead", 6, 10, 10, 0);
      for (const [p, q] of [[{ x: 56, y: 22 }, { x: 56, y: 44 }], [{ x: 68, y: 22 }, { x: 68, y: 44 }], [{ x: 56, y: 22 }, { x: 68, y: 22 }]]) { const w = wallBetween(d, 0, p, q); if (w) opening(d, w, "door", "interior", 3, 3, 7, 0); }
      label(d, 0, 28, 22, "Sales floor", "concrete"); label(d, 0, 68, 11, "Stock room", "concrete"); label(d, 0, 62, 33, "Office", "carpet"); label(d, 0, 74, 33, "Restroom", "tile");
      item(d, 0, "toilet", 78.4, 40, 3); item(d, 0, "sink-bath", 74, 42.8, 2); item(d, 0, "water-heater", 66, 2); item(d, 0, "panel", 79.6, 8, 1); item(d, 0, "desk", 62, 30);
      for (const x of [16, 40]) item(d, 0, "rtu", x, 22, 0, { roof: true });
      item(d, 0, "exhaust-fan", 74, 33, 0, { roof: true }); item(d, 0, "roof-hatch", 66, 6, 0, { roof: true }); item(d, 0, "pipe-boot", 76, 40, 0, { roof: true });
      d.runs.push({ id: uid("p"), level: 0, system: "duct", pts: [[16, 22], [16, 38], [40, 38], [40, 22]] });
      autoRoof(d);
      return d;
    },
  },
};

/* ---------- materials takeoff ---------- */
export function takeoff(doc) {
  const rows = []; // [section, item, qty, unit, note]
  const add = (s, i, q, u, n = "") => { if (q > 0) rows.push([s, i, q, u, n]); };
  const byAsm = {};
  doc.levels.forEach((lv, L) => {
    const rl = rooms(doc, L);
    for (const w of wallsOn(doc, L)) {
      const len = wallLength(doc, w), h = w.h || lv.height, side = outsideSide(doc, w, rl);
      const ops = doc.openings.filter((o) => o.wall === w.id), opA = ops.reduce((s, o) => s + o.w * o.h, 0);
      const k = (byAsm[w.asm] ||= { lf: 0, gross: 0, net: 0, openings: 0, ext: 0, interiorFaces: 0 });
      k.lf += len; k.gross += len * h; k.net += Math.max(0, len * h - opA); k.openings += ops.length;
      if (side === 1 || side === -1) k.ext += Math.max(0, len * h - opA);
      k.interiorFaces += (side === 0 ? 2 : 1) * Math.max(0, len * h - opA);
    }
  });
  for (const [id, k] of Object.entries(byAsm)) {
    const A = ASSEMBLIES[id], name = A?.name || id;
    add("Walls", `${name}: length`, Math.round(k.lf), "LF");
    if (A?.stud) {
      add("Framing", `${A.stud} studs @ ${A.oc}" o.c. (${name})`, Math.ceil((k.lf * 12) / A.oc) + k.openings * 3 + Math.ceil(k.lf / 10), "pcs", "includes kings, jacks and corners");
      add("Framing", `${A.stud} plates (${name})`, Math.ceil(k.lf * 3), "LF", "bottom + double top plate");
    }
    if (A?.cmu) add("Masonry", "8\" CMU block", Math.ceil((k.net * 1.125) * 1.05), "blocks", "1.125 per sq ft + 5%");
    if (A?.ext) {
      if (A.sheathing) add("Sheathing", "7/16\" OSB sheets (4×8)", Math.ceil((k.ext * 1.1) / 32), "sheets");
      if (A.wrb) add("Weather barrier", A.wrb, Math.ceil((k.ext * 1.1) / 1350), "rolls", "9 × 150 ft rolls, laps + 10%");
      add("Weather barrier", "Window & door flashing tape", Math.ceil(k.openings * 18), "LF");
      add("Cladding", A.cladding || "Siding", Math.ceil((k.ext * 1.1) / 100 * 10) / 10, A.claddingUnit || "squares", "+10% waste");
      if (A.insulation) add("Insulation", A.insulation, Math.ceil(k.ext), "sq ft");
    }
    if (A?.drywall !== false) add("Interior", "1/2\" drywall (4×8)", Math.ceil((k.interiorFaces * 1.12) / 32), "sheets", "+12% waste");
  }
  // openings
  const ops = {};
  for (const o of doc.openings) { const s = OPENINGS[o.type]?.styles[o.style]?.name || o.style, key = `${o.type === "door" ? "Door" : o.type === "window" ? "Window" : "Opening"}: ${s} ${fmtFtIn(o.w)} × ${fmtFtIn(o.h)}`; ops[key] = (ops[key] || 0) + 1; }
  Object.entries(ops).sort().forEach(([k, n]) => add("Doors & windows", k, n, "ea"));
  // roofs
  for (const r of doc.roofs) {
    const s = roofStats(r), mat = doc.settings.roofMaterial;
    if (r.type === "flat") {
      add("Roofing", `${mat === "tpo" ? "TPO" : mat === "epdm" ? "EPDM" : "Single-ply"} membrane`, Math.ceil(s.plan * 1.1 / 100), "squares", "+10% laps & flashing");
      add("Roofing", "Polyiso insulation boards (4×8)", Math.ceil(s.plan / 32), "boards");
      if (r.parapet) add("Roofing", "Metal parapet coping", Math.ceil(s.eaves), "LF");
    } else {
      add("Roofing", `${mat === "metal" ? "Standing-seam metal panels" : "Architectural shingles"} (${r.type}, ${r.pitch}/12)`, Math.ceil(s.sloped * 1.08 / 100 * 3) / 3, "squares", "+8% waste");
      add("Roofing", "Synthetic underlayment", Math.ceil(s.sloped / 1000), "rolls", "10 squares per roll");
      add("Roofing", "Ice & water shield (eaves + valleys)", Math.ceil((s.eaves * 6) / 200), "rolls", "2 courses at eaves");
      add("Roofing", "Drip edge", Math.ceil(s.eaves + s.rakes), "LF");
      add("Roofing", "Starter strip", Math.ceil(s.eaves + s.rakes), "LF");
      if (s.ridge + s.hips) add("Roofing", "Ridge / hip cap", Math.ceil(s.ridge + s.hips), "LF");
      if (s.ridge) add("Ventilation", "Ridge vent", Math.ceil(s.ridge), "LF");
      add("Roofing", "7/16\" OSB roof decking (4×8)", Math.ceil(s.sloped * 1.08 / 32), "sheets");
    }
  }
  // floors
  const fl = {};
  doc.levels.forEach((lv, L) => rooms(doc, L).forEach((r) => { fl[r.floor] = (fl[r.floor] || 0) + Math.abs(r.area); }));
  const FLOOR = { wood: "Hardwood flooring", tile: "Tile flooring", carpet: "Carpet", concrete: "Sealed concrete", lvp: "Luxury vinyl plank" };
  Object.entries(fl).forEach(([k, a]) => add("Floors", FLOOR[k] || k, Math.ceil(a * 1.1), "sq ft", "+10% waste"));
  // items + exterior structures
  const counts = {};
  for (const o of doc.objects) {
    const spec = ITEMS[o.type];
    if (!spec) continue;
    if (o.type === "deck" || o.type === "porch") {
      const A2 = o.w * o.d;
      add("Exterior", `${spec.name} ${fmtFtIn(o.w)} × ${fmtFtIn(o.d)}: decking`, Math.ceil(A2 * 1.1), "sq ft");
      add("Exterior", `${spec.name}: joists 2×8 @ 16"`, Math.ceil((o.w * 12) / 16) + 1, "pcs");
      add("Exterior", `${spec.name}: posts + footings`, Math.max(4, Math.ceil(o.w / 8 + 1) * 2), "ea");
      if (o.type === "deck") add("Exterior", "Deck railing", Math.ceil(o.w + o.d * 2), "LF");
      continue;
    }
    counts[spec.group + "|" + spec.name] = (counts[spec.group + "|" + spec.name] || 0) + 1;
  }
  Object.entries(counts).sort().forEach(([k, n]) => { const [g, name] = k.split("|"); add(g, name, n, "ea"); });
  // runs
  const RUN = { supply: ["Plumbing", "PEX water supply"], drain: ["Plumbing", "PVC drain / vent pipe"], gas: ["Plumbing", "Gas line"], duct: ["HVAC", "Supply ductwork"], return: ["HVAC", "Return ductwork"], wire: ["Electrical", "12/2 NM cable"] };
  const lf = {};
  for (const r of doc.runs) { let s = 0; for (let i = 1; i < r.pts.length; i++) s += Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]); lf[r.system] = (lf[r.system] || 0) + s; }
  Object.entries(lf).forEach(([k, s]) => add(RUN[k][0], RUN[k][1], Math.ceil(s * 1.15), "LF", "+15% for fittings and drops"));
  const order = ["Walls", "Framing", "Masonry", "Sheathing", "Weather barrier", "Insulation", "Cladding", "Doors & windows", "Roofing", "Ventilation", "Interior", "Floors", "Exterior", "Plumbing", "HVAC", "Electrical", "Kitchen & laundry", "Furniture", "Roof equipment"];
  return rows.sort((a, b) => (order.indexOf(a[0]) + 1 || 99) - (order.indexOf(b[0]) + 1 || 99));
}
export function fmtFtIn(ft) {
  const neg = ft < 0; ft = Math.abs(ft);
  let f = Math.floor(ft + 1e-6), i = Math.round((ft - f) * 12);
  if (i === 12) { f += 1; i = 0; }
  return `${neg ? "-" : ""}${f}'${i ? `-${i}"` : ""}`;
}
