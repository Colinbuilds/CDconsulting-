/* Lot + landscape: lawn, driveway, walkway, street, beds, shrubs, trees. */
import * as THREE from "three";
import * as TX from "./textures.js";
import { NO_AO } from "./stage.js";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
let seed = 99;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const rr = (a, b) => a + rnd() * (b - a);

function flat(shapePts, y, mat, uvScale) {
  const s = new THREE.Shape(shapePts.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ShapeGeometry(s, 24);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, mat);
  m.position.y = y;
  m.receiveShadow = true;
  if (uvScale && mat.map) mat.map.repeat.set(1 / uvScale, 1 / uvScale);
  return m;
}

function ribbon(curve, width, y, mat, seg = 80) {
  const pos = [], uv = [], idx = [];
  let len = 0, prev = curve.getPoint(0);
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, p = curve.getPoint(t), tan = curve.getTangent(t);
    len += p.distanceTo(prev); prev = p;
    const side = V(-tan.z, 0, tan.x).normalize().multiplyScalar(width / 2);
    const a = p.clone().add(side), b = p.clone().sub(side);
    pos.push(a.x, y, a.z, b.x, y, b.z);
    uv.push(0, len / width, 1, len / width);
    if (i < seg) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true;
  return m;
}

/* ---------- foliage ---------- */
class Foliage {
  constructor(kind, max) {
    const map = TX.leaves(kind);
    this.mat = new THREE.MeshStandardMaterial({ map, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.88 });
    this.mat.alphaToCoverage = true; // soft leaf edges under multisampling (HD)
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), this.mat, max);
    this.mesh.castShadow = this.mesh.receiveShadow = true;
    this.mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.5 });
    this.n = 0;
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.c = new THREE.Color();
  }
  card(p, out, size, tint) {
    if (this.n >= this.mesh.count) return;
    const dir = out.clone().add(V(rr(-0.6, 0.6), rr(-0.3, 0.7), rr(-0.6, 0.6))).normalize();
    this.q.setFromUnitVectors(V(0, 0, 1), dir);
    this.q.multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), rr(0, Math.PI * 2)));
    this.m.compose(p, this.q, V(size, size, size));
    this.mesh.setMatrixAt(this.n, this.m);
    this.mesh.setColorAt(this.n, this.c.copy(tint).multiplyScalar(rr(0.82, 1.12)));
    this.n++;
  }
  done() { this.mesh.count = this.n; this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true; }
}

function tree(group, leaves, barkMat, x, z, h, crownW, opts = {}) {
  const trunkH = h * (opts.trunk ?? 0.42), r = h * 0.022;
  const tr = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.7, r * 1.15, trunkH, 10), barkMat);
  tr.position.set(x, trunkH / 2, z); tr.castShadow = true; group.add(tr);
  // limbs
  const limbs = opts.limbs ?? 5;
  const ends = [];
  for (let i = 0; i < limbs; i++) {
    const a = (i / limbs) * Math.PI * 2 + rr(-0.3, 0.3);
    const start = V(x, trunkH * rr(0.8, 1), z);
    const end = V(x + Math.cos(a) * crownW * rr(0.25, 0.4), trunkH + h * rr(0.25, 0.42), z + Math.sin(a) * crownW * rr(0.25, 0.4));
    const len = start.distanceTo(end);
    const limb = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.25, r * 0.6, len, 7), barkMat);
    limb.position.copy(start).add(end).multiplyScalar(0.5);
    limb.quaternion.setFromUnitVectors(V(0, 1, 0), end.clone().sub(start).normalize());
    limb.castShadow = true; group.add(limb);
    ends.push(end);
  }
  // crown: clusters on an ellipsoid, cards face outward
  const cy = trunkH + (h - trunkH) * 0.5, ry = (h - trunkH) * 0.55, rx = crownW / 2;
  const center = V(x, cy, z);
  const clusters = opts.clusters ?? Math.round(crownW * 1.6);
  const tint = opts.tint || new THREE.Color(1, 1, 1);
  for (let k = 0; k < clusters; k++) {
    const u = rnd() * Math.PI * 2, v = Math.acos(rr(-0.75, 1));
    const rad = Math.pow(rnd(), 0.35);
    const cp = V(x + Math.sin(v) * Math.cos(u) * rx * rad, cy + Math.cos(v) * ry * rad, z + Math.sin(v) * Math.sin(u) * rx * rad);
    const out = cp.clone().sub(center).normalize();
    const per = opts.cards ?? 18;
    const spread = crownW * 0.16;
    for (let i = 0; i < per; i++) {
      const p = cp.clone().add(V(rr(-1, 1) * spread, rr(-0.7, 0.7) * spread, rr(-1, 1) * spread));
      leaves.card(p, out, rr(0.8, 1.25) * crownW * 0.19, tint);
    }
  }
}

function shrub(shrubs, x, z, r, h = r * 1.2) {
  const center = V(x, h * 0.5, z);
  const n = Math.round(r * r * 28);
  for (let i = 0; i < n; i++) {
    const u = rnd() * Math.PI * 2, v = Math.acos(rr(-0.2, 1));
    const p = V(x + Math.sin(v) * Math.cos(u) * r, h * 0.5 + Math.cos(v) * h * 0.5, z + Math.sin(v) * Math.sin(u) * r);
    shrubs.card(p, p.clone().sub(center).normalize(), rr(0.9, 1.4) * r * 0.75, new THREE.Color(1, 1, 1));
  }
}

export function buildSite() {
  const g = new THREE.Group();

  // lawn with large-scale color variation
  const lawnMap = TX.photo("lawn", { repeat: 48 });
  const lawnGeo = new THREE.PlaneGeometry(720, 720, 90, 90);
  lawnGeo.rotateX(-Math.PI / 2);
  const cols = [];
  const pos = lawnGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const n = 0.5 + 0.25 * Math.sin(x * 0.045 + z * 0.02) + 0.2 * Math.sin(z * 0.07 - x * 0.03) + rr(-0.06, 0.06);
    // mowing stripes on the front lawn
    const stripe = z > 22 && z < 56 ? (Math.floor((x + 200) / 9) % 2 ? 0.06 : -0.04) : 0;
    const k = 0.7 + n * 0.22 + stripe;
    cols.push(0.46 * k, 0.74 * k, 0.33 * k);
  }
  lawnGeo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  const lawn = new THREE.Mesh(lawnGeo, new THREE.MeshStandardMaterial({ map: lawnMap, vertexColors: true, roughness: 0.97 }));
  lawn.receiveShadow = true;
  g.add(lawn);

  // driveway + control joints
  const concrete = new THREE.MeshStandardMaterial({ map: TX.photo("concrete", { repeat: 1 / 10 }), color: "#d8d4ca", roughness: 0.9 });
  g.add(flat([[20.2, 10], [37.8, 10], [38.5, 50], [42, 56], [16, 56], [19.5, 50]], 0.05, concrete));
  const joint = new THREE.MeshStandardMaterial({ color: "#6d6a64", roughness: 1 });
  for (let z = 20; z < 56; z += 10) { const j = new THREE.Mesh(new THREE.BoxGeometry(18.4, 0.04, 0.12), joint); j.position.set(29, 0.06, z); g.add(j); }
  { const j = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 46), joint); j.position.set(29, 0.06, 33); g.add(j); }

  // sidewalk, curb, street
  const walk = concrete.clone(); walk.map = concrete.map;
  g.add(flat([[-200, 56], [200, 56], [200, 61], [-200, 61]], 0.06, walk));
  const curb = new THREE.Mesh(new THREE.BoxGeometry(400, 0.5, 0.6), new THREE.MeshStandardMaterial({ color: "#bdb9b0", roughness: 0.9 }));
  curb.position.set(0, 0.1, 66.3); curb.receiveShadow = true; g.add(curb);
  const asphaltMap = TX.photo("concrete", { repeat: 1 / 6 });
  g.add(flat([[-400, 66.6], [400, 66.6], [400, 110], [-400, 110]], 0.02, new THREE.MeshStandardMaterial({ map: asphaltMap, color: "#3a3b3d", roughness: 0.95 })));
  const strip = new THREE.MeshStandardMaterial({ color: "#d8c27a", roughness: 0.8 });
  for (let x = -400; x < 400; x += 18) { const s = new THREE.Mesh(new THREE.BoxGeometry(10, 0.02, 0.35), strip); s.position.set(x, 0.04, 88); g.add(s); }

  // paver walkway: porch steps → curve → driveway
  const pav = new THREE.MeshStandardMaterial({ map: TX.photo("pavers", { repeat: 1, repeatY: 0.5 }), color: "#b8b2a6", roughness: 0.9 });
  const path = new THREE.CatmullRomCurve3([V(4, 0, 24.4), V(4, 0, 30), V(8, 0, 36), V(16, 0, 38), V(20.3, 0, 38)]);
  g.add(ribbon(path, 4.2, 0.055, pav));

  // mulch beds along the front
  const mulch = new THREE.MeshStandardMaterial({ map: TX.photo("mulch", { repeat: 1 / 6 }), color: "#7a5b45", roughness: 1 });
  const bedA = [[-21, 14], [-16.2, 14], [-16.2, 18.2], [-3.8, 18.2], [-3.8, 21.6], [1.9, 21.6], [1.9, 25], [-6, 26.5], [-16, 25.5], [-22, 22]];
  const bedB = [[6.1, 21.6], [14.6, 21.6], [14.6, 14.2], [18.2, 14.2], [18.2, 23.5], [12, 26], [6.1, 25]];
  g.add(flat(bedA, 0.07, mulch));
  g.add(flat(bedB, 0.07, mulch));

  // shrubs + trees
  const shrubs = new Foliage("shrub", 9000);
  for (const [x, z, r] of [[-19.5, 20.5, 1.5], [-15, 22.5, 1.7], [-11, 23, 1.6], [-7, 23, 1.7], [-2.5, 23.4, 1.4], [0.6, 23.2, 1.1],
    [7.6, 23.2, 1.2], [10.6, 23.6, 1.5], [13.8, 23.4, 1.4], [16.8, 19.5, 1.5], [16.8, 16, 1.3],
    [-24, 4, 2], [-24, 10, 2.2], [43, 4, 2], [43, -6, 2.2]]) shrub(shrubs, x, z, r);
  shrubs.done();
  shrubs.mesh.layers.set(NO_AO);
  g.add(shrubs.mesh);

  const bark = new THREE.MeshStandardMaterial({ map: TX.photo("bark", { repeat: 1, repeatY: 3 }), normalMap: TX.photo("bark-nor", { srgb: false, repeat: 1, repeatY: 3 }), roughness: 0.95 });
  const leaves = new Foliage("tree", 26000);
  const T = (x, z, h, w, o) => tree(g, leaves, bark, x, z, h, w, o);
  T(-74, 40, 38, 32, { tint: new THREE.Color(1, 1.02, 0.95) });          // big shade tree, front left
  T(76, 34, 24, 20, { tint: new THREE.Color(1.15, 1.05, 0.8), trunk: 0.38 }); // ornamental, front right
  T(-38, -34, 52, 34, {});
  T(26, -42, 48, 30, { tint: new THREE.Color(0.95, 1, 1) });
  T(70, -20, 40, 26, {});
  T(-70, -6, 44, 28, {});
  // tree line behind the lot
  for (let i = 0; i < 26; i++) {
    const a = Math.PI * (1.05 + (i / 25) * 0.9) + rr(-0.05, 0.05);
    const d = rr(120, 175);
    T(Math.cos(a) * d * 1.3, Math.sin(a) * d * 0.9 - 20, rr(45, 70), rr(30, 44), { clusters: 26, cards: 12, limbs: 3 });
  }
  leaves.done();
  leaves.mesh.layers.set(NO_AO);
  g.add(leaves.mesh);

  return g;
}
